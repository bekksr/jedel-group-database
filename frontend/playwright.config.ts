import { defineConfig } from '@playwright/test';
export default defineConfig({testDir: './e2e', workers: 1, timeout: 60000, use: {baseURL: process.env['JEDEL_E2E_URL'], headless: true, trace: 'retain-on-failure'}, reporter: 'list'});
