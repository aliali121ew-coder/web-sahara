import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { cloudflare } from "@cloudflare/vite-plugin";

const port = Number(process.env.PORT) || 3000;

// بيئات Cloudflare (wrangler.jsonc → env): إضافة Cloudflare تختارها من CLOUDFLARE_ENV وقت البناء،
// فـ "vite build --mode demo" يبني النسخة التجريبية بقاعدتها وحاوياتها (wrangler deploy --env وحده لا يغيّرها)
const CLOUDFLARE_ENVS = ['staging', 'demo'];

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  if (CLOUDFLARE_ENVS.includes(mode)) process.env.CLOUDFLARE_ENV ??= mode;
  return {
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
  };
});