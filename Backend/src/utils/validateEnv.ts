/**
 * Environment Variable Validation
 *
 * Validates all required environment variables at application startup.
 * Distinguishes between development and production requirements.
 */

interface EnvVarConfig {
  name: string;
  required: 'always' | 'production' | 'development';
  description: string;
  minLength?: number;
  validator?: (value: string) => boolean;
  validatorMessage?: string;
}

const ENV_VARS: EnvVarConfig[] = [
  // JWT Secrets - always required
  {
    name: 'JWT_ACCESS_SECRET',
    required: 'always',
    description: 'Secret key for signing JWT access tokens',
    minLength: 32,
  },
  {
    name: 'JWT_REFRESH_SECRET',
    required: 'always',
    description: 'Secret key for signing JWT refresh tokens',
    minLength: 32,
  },

  // Encryption keys - required in production
  {
    name: 'ENCRYPTION_KEY',
    required: 'production',
    description: 'Master encryption key for sensitive data',
    minLength: 32,
  },
  {
    name: 'ENCRYPTION_SALT',
    required: 'production',
    description: 'Salt for encryption key derivation',
    minLength: 16,
  },
  {
    name: 'EMR_ENCRYPTION_KEY',
    required: 'always',
    description: 'Encryption key for EMR/FHIR token storage',
    minLength: 32,
  },

  // Database
  {
    name: 'DATABASE_URL',
    required: 'always',
    description: 'PostgreSQL connection string',
    validator: (value) => value.startsWith('postgresql://') || value.startsWith('postgres://'),
    validatorMessage: 'Must be a valid PostgreSQL connection string',
  },

  // Optional but recommended in production
  {
    name: 'CORS_ALLOWED_ORIGINS',
    required: 'production',
    description: 'Comma-separated list of allowed CORS origins',
  },
];

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates environment variables based on the current NODE_ENV
 */
export function validateEnvironment(): ValidationResult {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const config of ENV_VARS) {
    const value = process.env[config.name];
    const isRequired =
      config.required === 'always' ||
      (config.required === 'production' && isProduction) ||
      (config.required === 'development' && !isProduction);

    // Check if required variable is missing
    if (!value) {
      if (isRequired) {
        errors.push(
          `Missing required environment variable: ${config.name}\n` +
          `  Description: ${config.description}`
        );
      } else if (isProduction && config.required === 'production') {
        // This shouldn't happen due to isRequired logic, but kept for safety
        errors.push(
          `Missing production-required environment variable: ${config.name}\n` +
          `  Description: ${config.description}`
        );
      } else {
        // Not required but recommended
        warnings.push(
          `Optional environment variable not set: ${config.name}\n` +
          `  Description: ${config.description}`
        );
      }
      continue;
    }

    // Check minimum length if specified
    if (config.minLength && value.length < config.minLength) {
      if (isRequired) {
        errors.push(
          `Environment variable ${config.name} is too short.\n` +
          `  Required minimum length: ${config.minLength} characters\n` +
          `  Current length: ${value.length} characters`
        );
      } else {
        warnings.push(
          `Environment variable ${config.name} is shorter than recommended.\n` +
          `  Recommended minimum length: ${config.minLength} characters\n` +
          `  Current length: ${value.length} characters`
        );
      }
    }

    // Run custom validator if specified
    if (config.validator && !config.validator(value)) {
      const message = config.validatorMessage || 'Invalid value';
      if (isRequired) {
        errors.push(
          `Environment variable ${config.name} has invalid value.\n` +
          `  ${message}`
        );
      } else {
        warnings.push(
          `Environment variable ${config.name} has potentially invalid value.\n` +
          `  ${message}`
        );
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates environment and throws if critical errors are found
 * Call this at application startup before any other initialization
 */
export function validateEnvOrExit(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  console.log(`[Environment] Validating environment variables for ${nodeEnv}...`);

  const result = validateEnvironment();

  // Log warnings
  for (const warning of result.warnings) {
    console.warn(`[Environment] WARNING: ${warning}`);
  }

  // Log errors and exit if invalid
  if (!result.isValid) {
    console.error('\n[Environment] CRITICAL: Environment validation failed!\n');
    for (const error of result.errors) {
      console.error(`[Environment] ERROR: ${error}\n`);
    }

    if (isProduction) {
      console.error(
        '[Environment] Application cannot start in production with missing or invalid environment variables.\n' +
        'Please set all required environment variables and restart.'
      );
      process.exit(1);
    } else {
      console.error(
        '[Environment] WARNING: Running in development mode with missing environment variables.\n' +
        'Some features may not work correctly. This configuration is NOT safe for production.'
      );
    }
  } else {
    console.log('[Environment] All required environment variables are set.');
  }
}

/**
 * Get a list of all required environment variables
 * Useful for documentation and setup scripts
 */
export function getRequiredEnvVars(forProduction = true): EnvVarConfig[] {
  return ENV_VARS.filter((config) => {
    if (config.required === 'always') return true;
    if (forProduction && config.required === 'production') return true;
    if (!forProduction && config.required === 'development') return true;
    return false;
  });
}

export default {
  validateEnvironment,
  validateEnvOrExit,
  getRequiredEnvVars,
};
