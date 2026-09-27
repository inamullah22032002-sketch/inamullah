import { ImportProvider, ExtractedMetadata } from './types';
import { validateUrlForSsrf, safeFetchHtml } from './url-security';
import { JsonLdProvider } from './providers/jsonld';
import { OpenGraphProvider } from './providers/generic-opengraph';

export class UrlImportManager {
  private providers: ImportProvider[] = [];

  constructor() {
    // Registered in priority order: structured JSON-LD first, then OpenGraph
    this.providers.push(new JsonLdProvider());
    this.providers.push(new OpenGraphProvider());
  }

  public registerProvider(provider: ImportProvider) {
    this.providers.unshift(provider);
  }

  public async analyzeUrl(urlString: string): Promise<ExtractedMetadata> {
    // 1. SSRF validation & protocol verification
    const safeUrl = await validateUrlForSsrf(urlString);

    // 2. Safe HTTP fetch with timeout and size cap
    const html = await safeFetchHtml(safeUrl);

    // 3. Evaluate providers
    for (const provider of this.providers) {
      if (provider.canHandle(safeUrl)) {
        try {
          const metadata = await provider.fetchMetadata(safeUrl, html);
          if (metadata && metadata.title) {
            return metadata;
          }
        } catch (err) {
          // Provider-specific error, try next provider
          console.warn(`Provider ${provider.name} failed for ${safeUrl.hostname}:`, err);
        }
      }
    }

    throw new Error('IMPORT_PROVIDER_NOT_SUPPORTED: Could not extract movie or media metadata from this web page.');
  }
}

export const urlImportManager = new UrlImportManager();
