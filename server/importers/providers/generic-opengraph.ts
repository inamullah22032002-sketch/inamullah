import { ImportProvider, ExtractedMetadata } from '../types';

export class OpenGraphProvider implements ImportProvider {
  name = 'OpenGraph & Meta Tags Provider';

  canHandle(url: URL): boolean {
    return true;
  }

  async fetchMetadata(url: URL, html: string): Promise<ExtractedMetadata | null> {
    const getMeta = (property: string): string | undefined => {
      const regex = new RegExp(`<meta\\s+[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i');
      const match = html.match(regex);
      if (match && match[1]) return match[1].trim();

      // Alternate attribute order
      const regexAlt = new RegExp(`<meta\\s+[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`, 'i');
      const matchAlt = html.match(regexAlt);
      return matchAlt && matchAlt[1] ? matchAlt[1].trim() : undefined;
    };

    const ogTitle = getMeta('og:title') || getMeta('twitter:title');
    const titleTagMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = ogTitle || (titleTagMatch ? titleTagMatch[1].trim() : undefined);

    if (!title) return null;

    const description =
      getMeta('og:description') ||
      getMeta('description') ||
      getMeta('twitter:description') ||
      '';

    const posterUrl =
      getMeta('og:image') ||
      getMeta('twitter:image') ||
      getMeta('image');

    const ogType = getMeta('og:type') || '';
    const isTv = ogType.includes('tv_show') || ogType.includes('episode') || /season|series|episode/i.test(title);

    const releaseYearMatch = title.match(/\b(19\d{2}|20\d{2})\b/) || description.match(/\b(19\d{2}|20\d{2})\b/);
    const releaseYear = releaseYearMatch ? parseInt(releaseYearMatch[1], 10) : undefined;

    // Cleaned title (stripping trailing "- IMDb", "| Netflix", etc.)
    const cleanTitle = title.replace(/\s*[-–|:]\s*(IMDb|Netflix|Rotten Tomatoes|Wikipedia|Trailer|Stream).*$/i, '').trim();

    const keywords = getMeta('keywords');
    const tags = keywords ? keywords.split(',').map(s => s.trim()).filter(Boolean) : undefined;

    return {
      title: cleanTitle,
      description,
      posterUrl,
      releaseYear,
      type: isTv ? 'tv' : 'movie',
      tags,
      sourceUrl: url.toString(),
      provider: this.name,
    };
  }
}
