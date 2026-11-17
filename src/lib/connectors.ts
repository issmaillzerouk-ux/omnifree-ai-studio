// ============================================================================
// connectors — One-Click Connected Apps & Tools Hub (Phase 10B)
// Zero-key instant services + one-click portal-key services, persisted locally
// ============================================================================

export type ConnectorId =
  | 'pollinations'
  | 'jina'
  | 'openscience'
  | 'tts'
  | 'tavily'
  | 'huggingface'
  | 'automation'
  | 'github'
  | 'notion'
  | 'custom';

export interface ConnectorDefinition {
  id: ConnectorId;
  name: string;
  description: string;
  /** Connected with a single toggle, no key needed. */
  zeroKey: boolean;
  portalUrl?: string;
  keyLabel?: string;
  keyPlaceholder?: string;
}

export const CONNECTOR_CATALOG: ConnectorDefinition[] = [
  {
    id: 'pollinations',
    name: 'Pollinations Visual Engine',
    description: 'Instant 100% free AI image generation — zero API key required.',
    zeroKey: true,
  },
  {
    id: 'jina',
    name: 'Jina Live Web Reader',
    description: 'Paste any http(s) URL in chat and it is fetched as clean Markdown into the AI context in real time.',
    zeroKey: true,
  },
  {
    id: 'openscience',
    name: 'Open Knowledge & Science Search',
    description: 'Live encyclopedic facts (Wikipedia) and academic papers (arXiv, Semantic Scholar) enrich the AI context automatically.',
    zeroKey: true,
  },
  {
    id: 'tts',
    name: 'Browser Neural Voice / TTS',
    description: 'Speaks stories, lessons and video scripts aloud in Arabic, French and English.',
    zeroKey: true,
  },
  {
    id: 'tavily',
    name: 'Tavily AI Web Search',
    description: 'Live AI-optimized web search results injected into the conversation.',
    zeroKey: false,
    portalUrl: 'https://app.tavily.com/home',
    keyLabel: 'Tavily API Key',
    keyPlaceholder: 'tvly-...',
  },
  {
    id: 'huggingface',
    name: 'Hugging Face Inference',
    description: 'Free FLUX.1 image generation and open text-to-video models.',
    zeroKey: false,
    portalUrl: 'https://huggingface.co/settings/tokens',
    keyLabel: 'Access Token',
    keyPlaceholder: 'hf_...',
  },
  {
    id: 'automation',
    name: 'n8n / Make / Zapier Webhook',
    description: 'Adds a "Send to Automation" button on every AI response.',
    zeroKey: false,
    keyLabel: 'Webhook URL',
    keyPlaceholder: 'https://your-hook.example.com/webhook',
  },
  {
    id: 'github',
    name: 'GitHub Gist / Repo Exporter',
    description: 'One-click export of generated code, Markdown reports or lessons to GitHub Gists.',
    zeroKey: false,
    portalUrl: 'https://github.com/settings/tokens',
    keyLabel: 'Personal Access Token',
    keyPlaceholder: 'ghp_...',
  },
  {
    id: 'notion',
    name: 'Notion Workspace Sync',
    description: 'Send structured notes and tables directly to your Notion workspace.',
    zeroKey: false,
    portalUrl: 'https://www.notion.so/my-integrations',
    keyLabel: 'Integration Token',
    keyPlaceholder: 'ntn_...',
  },
  {
    id: 'custom',
    name: 'Custom OpenAPI / MCP Tool Connector',
    description: 'Plug in any external REST/OpenAPI tool endpoint by URL.',
    zeroKey: false,
    keyLabel: 'Tool Endpoint URL',
    keyPlaceholder: 'https://api.example.com/openapi.json',
  },
];

// ---------------------------------------------------------------------------
// Local persistence
// ---------------------------------------------------------------------------

interface ConnectorState {
  connected: Partial<Record<ConnectorId, boolean>>;
  keys: Partial<Record<ConnectorId, string>>;
}

const STATE_KEY = 'omnifree-connectors';

const ZERO_KEY_DEFAULTS: ConnectorId[] = ['pollinations', 'jina', 'openscience', 'tts'];

export function loadConnectorState(): ConnectorState {
  try {
    const stored = localStorage.getItem(STATE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ConnectorState;
      const connected = { ...parsed.connected };
      for (const id of ZERO_KEY_DEFAULTS) {
        if (connected[id] === undefined) connected[id] = true;
      }
      return { connected, keys: parsed.keys ?? {} };
    }
  } catch {
    // fall through to defaults
  }
  const connected: Partial<Record<ConnectorId, boolean>> = {};
  for (const id of ZERO_KEY_DEFAULTS) connected[id] = true;
  return { connected, keys: {} };
}

export function saveConnectorState(state: ConnectorState): void {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

export function isConnectorConnected(state: ConnectorState, id: ConnectorId): boolean {
  return state.connected[id] ?? false;
}

export function getConnectorKey(state: ConnectorState, id: ConnectorId): string {
  return state.keys[id] ?? '';
}

// ---------------------------------------------------------------------------
// Jina Live Web Reader
// ---------------------------------------------------------------------------

export function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"')\]]+/g);
  return matches ? [...new Set(matches)] : [];
}

export async function fetchViaJina(url: string): Promise<string> {
  const response = await fetch(`https://r.jina.ai/${url}`);
  if (!response.ok) {
    throw new Error(`Jina Reader failed (HTTP ${response.status})`);
  }
  const text = await response.text();
  return text.slice(0, 8000);
}

// ---------------------------------------------------------------------------
// Open Knowledge & Science Search
// ---------------------------------------------------------------------------

export interface KnowledgeSnippet {
  source: string;
  title: string;
  text: string;
}

interface WikipediaResponse {
  query?: {
    search?: Array<{ title?: string; snippet?: string }>;
  };
}

interface SemanticScholarResponse {
  data?: Array<{ title?: string; abstract?: string; year?: number }>;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

async function searchWikipedia(query: string): Promise<KnowledgeSnippet[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=2`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = (await response.json()) as WikipediaResponse;
  return (data.query?.search ?? []).map((hit) => ({
    source: 'Wikipedia',
    title: hit.title ?? 'Untitled',
    text: stripHtml(hit.snippet ?? '').slice(0, 600),
  }));
}

async function searchSemanticScholar(query: string): Promise<KnowledgeSnippet[]> {
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=2&fields=title,abstract,year`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = (await response.json()) as SemanticScholarResponse;
  return (data.data ?? []).map((paper) => ({
    source: `Semantic Scholar${paper.year ? ` ${paper.year}` : ''}`,
    title: paper.title ?? 'Untitled',
    text: (paper.abstract ?? 'No abstract available.').slice(0, 600),
  }));
}

export async function searchOpenKnowledge(query: string): Promise<KnowledgeSnippet[]> {
  const results = await Promise.allSettled([searchWikipedia(query), searchSemanticScholar(query)]);
  const snippets: KnowledgeSnippet[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') snippets.push(...result.value);
  }
  return snippets;
}

// ---------------------------------------------------------------------------
// Tavily AI web search
// ---------------------------------------------------------------------------

interface TavilyResponse {
  answer?: string;
  results?: Array<{ title?: string; content?: string }>;
}

export async function tavilySearch(key: string, query: string): Promise<string> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: key, query, max_results: 3 }),
  });
  if (!response.ok) {
    throw new Error(`Tavily search failed (HTTP ${response.status})`);
  }
  const data = (await response.json()) as TavilyResponse;
  const parts = (data.results ?? []).map((r) => `- ${r.title ?? 'Result'}: ${(r.content ?? '').slice(0, 300)}`);
  return [data.answer, ...parts].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// Automation webhook / GitHub gist / Notion
// ---------------------------------------------------------------------------

export async function sendToAutomation(webhookUrl: string, payload: { text: string; provider?: string }): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: payload.text, provider: payload.provider, sentAt: Date.now() }),
  });
  if (!response.ok) {
    throw new Error(`Automation webhook failed (HTTP ${response.status})`);
  }
}

export async function exportToGist(token: string, filename: string, content: string): Promise<string> {
  const response = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      description: 'Exported from OmniFree AI Studio',
      public: false,
      files: { [filename]: { content } },
    }),
  });
  if (!response.ok) {
    throw new Error(`GitHub export failed (HTTP ${response.status})`);
  }
  const data = (await response.json()) as { html_url?: string };
  return data.html_url ?? 'Created';
}

interface NotionPageResponse {
  url?: string;
}

export async function exportToNotion(token: string, title: string, markdown: string): Promise<string> {
  // Appends a paragraph block to the integration's workspace via the pages API
  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      parent: { type: 'workspace', workspace: true },
      properties: { title: [{ text: { content: title } }] },
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: { rich_text: [{ text: { content: markdown.slice(0, 2000) } }] },
        },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`Notion export failed (HTTP ${response.status})`);
  }
  const data = (await response.json()) as NotionPageResponse;
  return data.url ?? 'Created';
}
