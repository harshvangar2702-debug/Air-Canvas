import { defineConfig } from 'vite';

// MediaPipe Tasks and Rapier ship WASM that must be served with the right
// headers. We keep the config minimal for M0; WASM-specific tweaks arrive with
// the milestones that add those deps.
export default defineConfig({
  server: {
    host: true,
  },
  // Rapier's compat build inlines its WASM, so no special optimizeDeps needed
  // yet. Left here as the single place to add such config later.
});
