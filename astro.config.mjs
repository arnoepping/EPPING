// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://eppingmusic.com',
  // /brand/ is internal (noindex); 404 is never listed
  integrations: [sitemap({ filter: (page) => !page.includes('/brand/') })],
});
