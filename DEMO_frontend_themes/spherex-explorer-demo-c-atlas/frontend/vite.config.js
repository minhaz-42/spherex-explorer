import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// The data service (../backend) listens on :8000 by default. start.py sets
// SPHEREX_API_URL when it runs on another port.
const api = process.env.SPHEREX_API_URL || 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [tailwindcss()],
  server: { proxy: { '/api': api } },
  preview: { proxy: { '/api': api } },
});
