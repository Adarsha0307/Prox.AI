import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { validateSafeUrl } from './ssrf';

export async function extractUrl(url: string, maxRedirects = 5): Promise<string> {
  let currentUrl = url;
  
  for (let step = 0; step <= maxRedirects; step++) {
    const safeUrl = await validateSafeUrl(currentUrl);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    let res: Response;
    try {
      res = await fetch(safeUrl.href, { 
        redirect: 'manual', 
        signal: controller.signal 
      });
    } catch (e) {
      throw new Error(`Fetch failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      clearTimeout(timeout);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new Error('Redirect without location header');
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch URL: ${res.statusText}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }
    
    const size = parseInt(res.headers.get('content-length') || '0', 10);
    if (size > 5 * 1024 * 1024) {
      throw new Error('Response too large (exceeds 5MB)');
    }

    const html = await res.text();
    if (html.length > 5 * 1024 * 1024) {
      throw new Error('HTML content too large');
    }

    const doc = new JSDOM(html, { url: safeUrl.href });
    const reader = new Readability(doc.window.document);
    const article = reader.parse();
    
    if (!article || !article.textContent) {
      throw new Error('Could not extract meaningful text from URL');
    }

    return article.textContent.trim();
  }
  
  throw new Error('Too many redirects');
}
