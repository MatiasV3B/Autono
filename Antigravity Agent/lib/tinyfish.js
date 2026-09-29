/**
 * TinyFish Web Search Module for Antigravity Agent
 * Integrates @tiny-fish/sdk and TinyFish Search API.
 */

const TINYFISH_SEARCH_ENDPOINT = 'https://api.search.tinyfish.ai/';

/**
 * Execute a web search query using TinyFish
 * @param {string} query The search query string
 * @param {Object} [options] Optional configuration
 * @param {string} [options.apiKey] TinyFish API key (falls back to saved or public)
 * @param {number} [options.page=0] Page index
 * @param {string} [options.purpose] Short statement of task intent
 * @returns {Promise<{ query: string, results: Array<{ position: number, site_name: string, title: string, snippet: string, url: string }>, total_results: number, page: number }>}
 */
export async function searchWithTinyFish(query, options = {}) {
  const cleanQuery = (query || '').trim();
  if (!cleanQuery) {
    return { query: '', results: [], total_results: 0, page: 0 };
  }

  // Retrieve API key from options or storage
  let apiKey = options.apiKey;
  if (!apiKey && typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const stored = await chrome.storage.local.get('antigravity_settings');
      apiKey = stored?.antigravity_settings?.tinyFishApiKey;
    } catch {
      // ignore
    }
  }

  // 1. Try using the official @tiny-fish/sdk if available in module environment
  try {
    const { TinyFish } = await import('@tiny-fish/sdk');
    const client = new TinyFish({
      apiKey: apiKey || 'tf_demo_key',
    });
    const response = await client.search.query({
      query: cleanQuery,
      purpose: options.purpose || 'Antigravity browser agent web research',
      page: options.page || 0,
    });
    if (response && Array.isArray(response.results)) {
      return response;
    }
  } catch (sdkErr) {
    console.log('Falling back to direct TinyFish Search API request:', sdkErr?.message);
  }

  // 2. Direct HTTP Fetch to TinyFish Search API Gateway
  const params = new URLSearchParams({
    query: cleanQuery,
    page: String(options.page || 0),
  });
  if (options.purpose) {
    params.set('purpose', options.purpose);
  }

  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'antigravity-agent-extension/1.0.0',
    'X-TF-Request-Origin': 'tinyfish-antigravity',
  };
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  const res = await fetch(`${TINYFISH_SEARCH_ENDPOINT}?${params.toString()}`, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`TinyFish Search API error (${res.status}): ${errBody || res.statusText}`);
  }

  const data = await res.json();
  return {
    query: cleanQuery,
    results: Array.isArray(data.results) ? data.results : [],
    total_results: data.total_results || (data.results?.length || 0),
    page: data.page || 0,
  };
}

/**
 * Format TinyFish search results into a clean markdown prompt context block
 * @param {{ query: string, results: Array<any> }} searchResponse
 * @returns {string}
 */
export function formatTinyFishForPrompt(searchResponse) {
  if (!searchResponse || !searchResponse.results || searchResponse.results.length === 0) {
    return `[TinyFish Web Search]: No se encontraron resultados web para "${searchResponse?.query || ''}".`;
  }

  const lines = [
    `=== RESULTADOS DE BÚSQUEDA WEB (TINYFISH AI) ===`,
    `Consulta: "${searchResponse.query}"`,
    `Resultados encontrados: ${searchResponse.results.length}`,
    '',
  ];

  searchResponse.results.slice(0, 8).forEach((item, index) => {
    const pos = item.position || index + 1;
    const title = item.title || item.site_name || 'Sin título';
    const site = item.site_name ? ` (${item.site_name})` : '';
    const snippet = (item.snippet || '').replace(/\s+/g, ' ').trim();
    lines.push(`${pos}. [${title}]${site} → ${item.url}`);
    if (snippet) {
      lines.push(`   Resumen: "${snippet}"`);
    }
    lines.push('');
  });

  lines.push(`================================================`);
  return lines.join('\n');
}
