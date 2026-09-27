import { ImportProvider, ExtractedMetadata } from '../types';

export class JsonLdProvider implements ImportProvider {
  name = 'JSON-LD Schema.org Provider';

  canHandle(url: URL): boolean {
    return true; // Generic parser applicable to any valid web page with JSON-LD
  }

  async fetchMetadata(url: URL, html: string): Promise<ExtractedMetadata | null> {
    const jsonLdRegex = /<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;

    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const rawJson = match[1].trim();
        const data = JSON.parse(rawJson);

        const items = Array.isArray(data) ? data : (data['@graph'] ? data['@graph'] : [data]);

        for (const item of items) {
          const type = (item['@type'] || '').toLowerCase();
          if (type.includes('movie') || type.includes('tvseries') || type.includes('videoobject') || type.includes('creativework')) {
            const isTv = type.includes('tvseries');
            const releaseYear = item.datePublished
              ? parseInt(String(item.datePublished).slice(0, 4), 10)
              : undefined;

            let runtime: number | undefined;
            if (item.duration) {
              // Parse ISO 8601 duration e.g. PT2H15M or PT135M
              const durMatch = String(item.duration).match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
              if (durMatch) {
                const hours = parseInt(durMatch[1] || '0', 10);
                const minutes = parseInt(durMatch[2] || '0', 10);
                runtime = hours * 60 + minutes;
              }
            }

            const genres: string[] = [];
            if (Array.isArray(item.genre)) {
              genres.push(...item.genre.map(String));
            } else if (typeof item.genre === 'string') {
              genres.push(...item.genre.split(',').map((s: string) => s.trim()));
            }

            const castMembers: string[] = [];
            if (Array.isArray(item.actor)) {
              for (const a of item.actor) {
                const name = typeof a === 'string' ? a : a.name;
                if (name) castMembers.push(name);
              }
            }

            let director: string | undefined;
            if (item.director) {
              director = typeof item.director === 'string' ? item.director : item.director.name;
            }

            let posterUrl: string | undefined;
            if (typeof item.image === 'string') {
              posterUrl = item.image;
            } else if (item.image && typeof item.image.url === 'string') {
              posterUrl = item.image.url;
            }

            let imdbRating: number | undefined;
            if (item.aggregateRating && item.aggregateRating.ratingValue) {
              imdbRating = parseFloat(item.aggregateRating.ratingValue);
            }

            if (item.name) {
              return {
                title: item.name,
                originalTitle: item.alternateName,
                description: item.description || '',
                releaseYear,
                type: isTv ? 'tv' : 'movie',
                genre: genres.length ? genres : undefined,
                runtime,
                imdbRating,
                director,
                cast: castMembers.length ? castMembers : undefined,
                posterUrl,
                sourceUrl: url.toString(),
                provider: this.name,
              };
            }
          }
        }
      } catch (err) {
        // Continue searching other script tags
      }
    }

    return null;
  }
}
