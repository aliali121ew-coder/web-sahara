import { defineConfig } from 'vitest/config';

// اختبارات منفصلة عن إعداد Vite (بلا إضافة Cloudflare)
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
