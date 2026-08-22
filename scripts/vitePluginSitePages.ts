import type { HtmlTagDescriptor, Plugin } from 'vite';
import { GUIDE } from '../src/content/guide';
import {
  headInjectionTags, renderGuideIndex, renderPrivacyPage,
  renderRobotsTxt, renderSitemapXml, renderSpeciesPage,
} from '../src/content/pageTemplates';

/** All generated static files, keyed by output path. */
function generatedFiles(): Map<string, string> {
  const files = new Map<string, string>();
  files.set('guide/index.html', renderGuideIndex());
  for (const entry of GUIDE) files.set(`guide/${entry.id}/index.html`, renderSpeciesPage(entry));
  files.set('privacy/index.html', renderPrivacyPage());
  files.set('sitemap.xml', renderSitemapXml());
  files.set('robots.txt', renderRobotsTxt());
  return files;
}

export function sitePages(): Plugin {
  return {
    name: 'beastoria:site-pages',
    transformIndexHtml(): HtmlTagDescriptor[] {
      // headInjectionTags() returns the locally-declared HeadTagDescriptor shape from
      // pageTemplates (kept dependency-free from 'vite'); it structurally matches
      // Vite's HtmlTagDescriptor, so this cast is just bridging that boundary.
      return headInjectionTags() as HtmlTagDescriptor[];
    },
    generateBundle() {
      for (const [fileName, source] of generatedFiles()) {
        this.emitFile({ type: 'asset', fileName, source });
      }
    },
    configureServer(server) {
      // Serve the generated pages during `npm run dev` so styling is iterable.
      // (req.url is cast via unknown: @types/node isn't a project dependency, so
      // Vite's Connect.IncomingMessage type — which extends node:http's
      // IncomingMessage — resolves without that base's members here.)
      server.middlewares.use((req, res, next) => {
        const reqUrl = (req as unknown as { url?: string }).url ?? '';
        const url = reqUrl.split('?')[0] ?? '';
        const path = url.replace(/^\//, '').replace(/\/$/, '/');
        const file = generatedFiles().get(
          path.endsWith('/') || path === '' ? `${path}index.html` : path,
        );
        if (file === undefined) return next();
        res.setHeader(
          'Content-Type',
          path.endsWith('.xml') ? 'application/xml'
            : path.endsWith('.txt') ? 'text/plain'
            : 'text/html',
        );
        res.end(file);
      });
    },
  };
}
