import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the committed demo snapshot (real SPHEREx data recorded by
 * `make snapshot`), so they need no network and give the same answer every time. Playwright starts
 * its own API and web servers on ports that do not clash with `make dev`.
 */
// Override with E2E_API_PORT / E2E_WEB_PORT when another checkout is already using these.
const API_PORT = Number(process.env.E2E_API_PORT ?? 8010);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 5183);

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
      testIgnore: /responsive\.spec\.ts/,
    },
    { name: "phone", use: { ...devices["Pixel 7"] }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: [
    {
      command: `uv --directory ../backend run uvicorn spherex_explorer.main:app --port ${API_PORT}`,
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        // A throwaway cache, so tests never read a developer's cached live data.
        SPHEREX_CACHE_DIR: "../backend/.cache-e2e",
        SPHEREX_FRONTEND_DIST: "../frontend/no-dist",
      },
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { SPHEREX_API_URL: `http://127.0.0.1:${API_PORT}` },
    },
  ],
});
