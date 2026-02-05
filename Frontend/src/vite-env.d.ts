/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_SESSION_TIMEOUT_MS: string;
  readonly VITE_ENABLE_VOICE_RECORDING: string;
  readonly VITE_ENABLE_OFFLINE_MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
