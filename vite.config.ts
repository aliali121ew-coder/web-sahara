import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { cloudflare } from "@cloudflare/vite-plugin";

const port = Number(process.env.PORT) || 3000;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // مجلد حالة منفصل لكل منفذ حتى لا يتعارض خادمان يعملان معًا على نفس قاعدة البيانات المحلية (SQLITE_BUSY)
    cloudflare({ persistState: { path: `.wrangler/state-${process.env.STATE_PORT || 3715}` } })
  ],
  server: {
    // يستخدم المنفذ المخصص عبر PORT عند توفره، وإلا 3000
    port,
    host: true
  }
});