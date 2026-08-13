/**
 * FHIR Client Service
 *
 * Handles SMART on FHIR OAuth2 authentication and FHIR R4 API calls.
 * Supports multiple EMR connections (Epic, Cerner, etc.)
 */

import crypto from 'crypto';
import prisma from '../../config/prisma';
import { MockFhirService } from './mockFhir.service';
import { fhirPatientToSearchResult, buildFhirSearchQuery } from './emrMapping.service';
import type {
  FhirPatient,
  FhirBundle,
  PatientSearchParams,
  OAuthTokenResponse,
  SmartConfiguration,
  EmrPatientSearchResult,
} from './fhirTypes';
import type { EmrAccessToken } from '../../generated/prisma';

// ===========================================
// CONFIGURATION
// ===========================================

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

// EMR encryption key must be set via environment variable
const EMR_ENCRYPTION_KEY = process.env['EMR_ENCRYPTION_KEY'];

if (!EMR_ENCRYPTION_KEY) {
  throw new Error(
    'CRITICAL: EMR_ENCRYPTION_KEY environment variable is not set. ' +
    'This is required for secure EMR token encryption. ' +
    'Set EMR_ENCRYPTION_KEY to a secure random string.'
  );
}

const ENCRYPTION_KEY = EMR_ENCRYPTION_KEY;

// Ensure key is proper length for AES-256
function getEncryptionKey(): Buffer {
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  return key;
}

// ===========================================
// TOKEN ENCRYPTION
// ===========================================

/**
 * Encrypt a token for secure storage
 */
export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Combine IV + AuthTag + Encrypted data
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt a stored token
 */
export function decryptToken(encryptedData: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }

  const ivHex = parts[0] as string;
  const authTagHex = parts[1] as string;
  const encrypted = parts[2] as string;

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    getEncryptionKey(),
    iv
  ) as crypto.DecipherGCM;
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ===========================================
// FHIR CLIENT SERVICE
// ===========================================

export class FhirClientService {
  /**
   * Discover SMART configuration from FHIR server
   */
  static async discoverSmartConfig(fhirBaseUrl: string): Promise<SmartConfiguration | null> {
    try {
      // Try .well-known endpoint first
      const wellKnownUrl = `${fhirBaseUrl}/.well-known/smart-configuration`;
      const response = await fetch(wellKnownUrl, {
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        return await response.json() as SmartConfiguration;
      }

      // Fallback: try metadata endpoint
      const metadataUrl = `${fhirBaseUrl}/metadata`;
      const metaResponse = await fetch(metadataUrl, {
        headers: { Accept: 'application/fhir+json' },
      });

      if (metaResponse.ok) {
        const metadata = await metaResponse.json() as {
          rest?: Array<{ security?: { extension?: Array<{ url: string; extension?: Array<{ url: string; valueUri?: string }> }> } }>;
        };
        // Extract OAuth URLs from CapabilityStatement
        const security = metadata.rest?.[0]?.security;
        const oauthExtension = security?.extension?.find(
          (ext: { url: string }) => ext.url === 'http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris'
        );

        if (oauthExtension) {
          const getExtValue = (url: string) =>
            oauthExtension.extension?.find((e: { url: string }) => e.url === url)?.valueUri;

          return {
            authorization_endpoint: getExtValue('authorize') || '',
            token_endpoint: getExtValue('token') || '',
          };
        }
      }

      return null;
    } catch (error) {
      console.error('[FhirClient] Error discovering SMART config:', error);
      return null;
    }
  }

  /**
   * Generate OAuth state parameter
   */
  static generateOAuthState(connectionId: string, userId: string, redirectUri: string): string {
    const state = {
      connectionId,
      userId,
      redirectUri,
      nonce: crypto.randomBytes(16).toString('hex'),
    };
    return Buffer.from(JSON.stringify(state)).toString('base64url');
  }

  /**
   * Parse OAuth state parameter
   */
  static parseOAuthState(state: string): {
    connectionId: string;
    userId: string;
    redirectUri: string;
    nonce: string;
  } | null {
    try {
      return JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
  }

  /**
   * Get authorization URL for OAuth flow
   */
  static async getAuthorizationUrl(
    connectionId: string,
    userId: string,
    redirectUri: string
  ): Promise<string> {
    const connection = await prisma.emrConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new Error('EMR connection not found');
    }

    // Mock mode
    if (MockFhirService.isEnabled()) {
      const state = this.generateOAuthState(connectionId, userId, redirectUri);
      return MockFhirService.getAuthorizationUrl(connectionId, redirectUri, state);
    }

    // Real OAuth flow
    const authUrl = connection.authorizationUrl;
    if (!authUrl) {
      throw new Error('Authorization URL not configured for this connection');
    }

    const state = this.generateOAuthState(connectionId, userId, redirectUri);
    const scopes = connection.scopes.join(' ');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: connection.clientId,
      redirect_uri: redirectUri,
      scope: scopes,
      state: state,
      aud: connection.fhirBaseUrl,
    });

    return `${authUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  static async handleOAuthCallback(
    code: string,
    state: string
  ): Promise<EmrAccessToken> {
    const stateData = this.parseOAuthState(state);
    if (!stateData) {
      throw new Error('Invalid OAuth state');
    }

    const { connectionId, userId, redirectUri } = stateData;

    const connection = await prisma.emrConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new Error('EMR connection not found');
    }

    let tokenResponse: OAuthTokenResponse;

    // Mock mode
    if (MockFhirService.isEnabled()) {
      const mockTokens = await MockFhirService.exchangeCodeForToken(code);
      tokenResponse = mockTokens;
    } else {
      // Real token exchange
      const tokenUrl = connection.tokenUrl;
      if (!tokenUrl) {
        throw new Error('Token URL not configured for this connection');
      }

      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: connection.clientId,
      });

      // Add client secret if available (confidential client)
      if (connection.clientSecretEncrypted) {
        body.append('client_secret', decryptToken(connection.clientSecretEncrypted));
      }

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token exchange failed: ${error}`);
      }

      tokenResponse = await response.json() as OAuthTokenResponse;
    }

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

    // Store tokens (encrypted)
    const accessToken = await prisma.emrAccessToken.upsert({
      where: {
        connectionId_userId: { connectionId, userId },
      },
      update: {
        accessTokenEncrypted: encryptToken(tokenResponse.access_token),
        refreshTokenEncrypted: tokenResponse.refresh_token
          ? encryptToken(tokenResponse.refresh_token)
          : null,
        expiresAt,
        tokenType: tokenResponse.token_type,
        scope: tokenResponse.scope,
        isRevoked: false,
      },
      create: {
        connectionId,
        userId,
        accessTokenEncrypted: encryptToken(tokenResponse.access_token),
        refreshTokenEncrypted: tokenResponse.refresh_token
          ? encryptToken(tokenResponse.refresh_token)
          : null,
        expiresAt,
        tokenType: tokenResponse.token_type,
        scope: tokenResponse.scope,
      },
    });

    // Update connection last connected
    await prisma.emrConnection.update({
      where: { id: connectionId },
      data: {
        lastConnectedAt: new Date(),
        lastConnectionError: null,
      },
    });

    // Audit log
    await prisma.emrAuditLog.create({
      data: {
        connectionId,
        userId,
        action: 'AUTHORIZE',
        resourceType: 'OAuth',
        requestUrl: '[TOKEN_ENDPOINT]',
        responseStatus: 200,
      },
    });

    return accessToken;
  }

  /**
   * Refresh an access token
   */
  static async refreshAccessToken(tokenId: string): Promise<EmrAccessToken> {
    const existingToken = await prisma.emrAccessToken.findUnique({
      where: { id: tokenId },
      include: { connection: true },
    });

    if (!existingToken || !existingToken.refreshTokenEncrypted) {
      throw new Error('Token not found or no refresh token available');
    }

    let tokenResponse: OAuthTokenResponse;

    // Mock mode
    if (MockFhirService.isEnabled()) {
      const mockTokens = await MockFhirService.refreshToken(
        decryptToken(existingToken.refreshTokenEncrypted)
      );
      tokenResponse = {
        access_token: mockTokens.access_token,
        token_type: mockTokens.token_type,
        expires_in: mockTokens.expires_in,
        refresh_token: mockTokens.refresh_token,
      };
    } else {
      // Real token refresh
      const tokenUrl = existingToken.connection.tokenUrl;
      if (!tokenUrl) {
        throw new Error('Token URL not configured');
      }

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: decryptToken(existingToken.refreshTokenEncrypted),
        client_id: existingToken.connection.clientId,
      });

      if (existingToken.connection.clientSecretEncrypted) {
        body.append('client_secret', decryptToken(existingToken.connection.clientSecretEncrypted));
      }

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token refresh failed: ${error}`);
      }

      tokenResponse = await response.json() as OAuthTokenResponse;
    }

    // Update stored token
    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

    const updatedToken = await prisma.emrAccessToken.update({
      where: { id: tokenId },
      data: {
        accessTokenEncrypted: encryptToken(tokenResponse.access_token),
        refreshTokenEncrypted: tokenResponse.refresh_token
          ? encryptToken(tokenResponse.refresh_token)
          : existingToken.refreshTokenEncrypted,
        expiresAt,
        isRevoked: false,
      },
    });

    // Audit log
    await prisma.emrAuditLog.create({
      data: {
        connectionId: existingToken.connectionId,
        userId: existingToken.userId,
        action: 'REFRESH_TOKEN',
        resourceType: 'OAuth',
        requestUrl: '[TOKEN_ENDPOINT]',
        responseStatus: 200,
      },
    });

    return updatedToken;
  }

  /**
   * Get a valid access token for a user/connection
   * Auto-refreshes if expired
   */
  static async getValidToken(connectionId: string, userId: string): Promise<string> {
    const token = await prisma.emrAccessToken.findUnique({
      where: {
        connectionId_userId: { connectionId, userId },
      },
    });

    if (!token || token.isRevoked) {
      throw new Error('No valid token found. Please re-authorize.');
    }

    // Check if expired (with 5 minute buffer)
    const now = new Date();
    const expirationBuffer = 5 * 60 * 1000; // 5 minutes

    if (token.expiresAt.getTime() - expirationBuffer < now.getTime()) {
      // Token expired or about to expire, refresh it
      if (token.refreshTokenEncrypted) {
        const refreshedToken = await this.refreshAccessToken(token.id);
        return decryptToken(refreshedToken.accessTokenEncrypted);
      } else {
        throw new Error('Token expired and no refresh token available');
      }
    }

    return decryptToken(token.accessTokenEncrypted);
  }

  /**
   * Search patients in EMR
   */
  static async searchPatients(
    connectionId: string,
    userId: string,
    params: PatientSearchParams
  ): Promise<EmrPatientSearchResult[]> {
    const connection = await prisma.emrConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new Error('EMR connection not found');
    }

    const startTime = Date.now();
    let bundle: FhirBundle<FhirPatient>;

    // Mock mode
    if (MockFhirService.isEnabled()) {
      bundle = MockFhirService.searchPatients(params);
    } else {
      const accessToken = await this.getValidToken(connectionId, userId);
      const queryString = buildFhirSearchQuery(params as Record<string, string | number | undefined>);
      const url = `${connection.fhirBaseUrl}/Patient${queryString}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/fhir+json',
        },
      });

      const durationMs = Date.now() - startTime;

      // Audit log
      await prisma.emrAuditLog.create({
        data: {
          connectionId,
          userId,
          action: 'SEARCH',
          resourceType: 'Patient',
          requestUrl: `Patient${queryString}`,
          responseStatus: response.status,
          durationMs,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Patient search failed: ${error}`);
      }

      bundle = await response.json() as FhirBundle<FhirPatient>;
    }

    // Check which patients are already imported
    const fhirIds = bundle.entry
      ?.map(e => e.resource?.id)
      .filter((id): id is string => !!id) || [];

    const existingLinks = await prisma.emrPatientLink.findMany({
      where: {
        connectionId,
        fhirPatientId: { in: fhirIds },
      },
    });

    const linkMap = new Map(existingLinks.map(l => [l.fhirPatientId, l.patientId]));

    // Convert to search results
    const results: EmrPatientSearchResult[] = [];

    for (const entry of bundle.entry || []) {
      if (entry.resource && entry.resource.resourceType === 'Patient') {
        const fhirId = entry.resource.id || '';
        const localPatientId = linkMap.get(fhirId);

        results.push(
          fhirPatientToSearchResult(
            entry.resource,
            !!localPatientId,
            localPatientId
          )
        );
      }
    }

    return results;
  }

  /**
   * Get a single patient from EMR
   */
  static async getPatient(
    connectionId: string,
    userId: string,
    fhirId: string
  ): Promise<FhirPatient> {
    const connection = await prisma.emrConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new Error('EMR connection not found');
    }

    const startTime = Date.now();

    // Mock mode
    if (MockFhirService.isEnabled()) {
      const patient = MockFhirService.getPatient(fhirId);
      if (!patient) {
        throw new Error('Patient not found');
      }
      return patient;
    }

    // Real API call
    const accessToken = await this.getValidToken(connectionId, userId);
    const url = `${connection.fhirBaseUrl}/Patient/${fhirId}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/fhir+json',
      },
    });

    const durationMs = Date.now() - startTime;

    // Audit log
    await prisma.emrAuditLog.create({
      data: {
        connectionId,
        userId,
        action: 'READ',
        resourceType: 'Patient',
        resourceId: fhirId,
        requestUrl: `Patient/${fhirId}`,
        responseStatus: response.status,
        patientFhirId: fhirId,
        durationMs,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Patient not found');
      }
      const error = await response.text();
      throw new Error(`Failed to get patient: ${error}`);
    }

    return await response.json() as FhirPatient;
  }

  /**
   * Revoke a user's token for a connection
   */
  static async revokeToken(connectionId: string, userId: string): Promise<void> {
    await prisma.emrAccessToken.updateMany({
      where: { connectionId, userId },
      data: { isRevoked: true },
    });

    await prisma.emrAuditLog.create({
      data: {
        connectionId,
        userId,
        action: 'REVOKE_TOKEN',
        resourceType: 'OAuth',
        requestUrl: '[REVOKE]',
        responseStatus: 200,
      },
    });
  }

  /**
   * Test connection to EMR
   */
  static async testConnection(connectionId: string): Promise<{
    success: boolean;
    message: string;
    capabilities?: string[];
  }> {
    const connection = await prisma.emrConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      return { success: false, message: 'Connection not found' };
    }

    // Mock mode always succeeds
    if (MockFhirService.isEnabled()) {
      return {
        success: true,
        message: 'Mock mode - connection simulated',
        capabilities: ['patient/*.read', 'launch/patient'],
      };
    }

    try {
      // Try to fetch CapabilityStatement
      const metadataUrl = `${connection.fhirBaseUrl}/metadata`;
      const response = await fetch(metadataUrl, {
        headers: { Accept: 'application/fhir+json' },
      });

      if (!response.ok) {
        return {
          success: false,
          message: `Server returned ${response.status}: ${response.statusText}`,
        };
      }

      const metadata = await response.json() as { fhirVersion?: string };
      const version = metadata.fhirVersion || 'unknown';

      // Update connection
      await prisma.emrConnection.update({
        where: { id: connectionId },
        data: {
          lastConnectedAt: new Date(),
          lastConnectionError: null,
        },
      });

      return {
        success: true,
        message: `Connected successfully. FHIR version: ${version}`,
        capabilities: connection.scopes,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update connection with error
      await prisma.emrConnection.update({
        where: { id: connectionId },
        data: {
          lastConnectionError: errorMessage,
        },
      });

      return {
        success: false,
        message: `Connection failed: ${errorMessage}`,
      };
    }
  }
}

export default FhirClientService;
