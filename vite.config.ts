import { defineConfig } from 'vite';
import { sitePages } from './scripts/vitePluginSitePages';

export default defineConfig({
  // Relative base so the build works on GitHub Pages subpaths and any static host.
  base: './',
  plugins: [sitePages()],
  build: {
    target: 'es2022',
  },
});
