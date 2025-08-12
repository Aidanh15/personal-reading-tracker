/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly NODE_ENV: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// For Node.js process.env in tests
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: string;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};