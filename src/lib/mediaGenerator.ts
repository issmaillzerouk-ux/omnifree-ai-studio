// ============================================================================
// mediaGenerator — Zero-failure image & video generation engine (Phase 10B)
// Premium/free key providers first, Pollinations fallback guarantees success
// ============================================================================

export type AspectRatio = '1:1' | '16:9' | '9:16';

export type VideoMode = 'ai-video' | 'motion-storyboard';

export const RATIO_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
};

const OPENAI_SIZES: Record<AspectRatio, string> = {
  '1:1': '1024x1024',
  '16:9': '1536x1024',
  '9:16': '1024x1536',
};

export interface GeneratedImage {
  /** data URL or remote URL suitable for <img src> */
  url: string;
  providerName: string;
}

export interface StoryboardScene {
  imageUrl: string;
  captionEn: string;
  captionAr: string;
}

export interface Storyboard {
  titleEn: string;
  titleAr: string;
  scenes: StoryboardScene[];
}

// ---------------------------------------------------------------------------
// Image generation pipeline
// ---------------------------------------------------------------------------

function dataUrlFromBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image blob'));
    reader.readAsDataURL(blob);
  });
}

interface OpenAIImageResponse {
  data?: Array<{ b64_json?: string; url?: string }>;
}

async function generateWithOpenAI(prompt: string, aspect: AspectRatio, key: string): Promise<GeneratedImage> {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, size: OPENAI_SIZES[aspect], n: 1 }),
  });
  if (!response.ok) throw new Error(`OpenAI image failed (HTTP ${response.status})`);
  const data = (await response.json()) as OpenAIImageResponse;
  const b64 = data.data?.[0]?.b64_json;
  if (b64) return { url: `data:image/png;base64,${b64}`, providerName: 'OpenAI' };
  const remote = data.data?.[0]?.url;
  if (remote) return { url: remote, providerName: 'OpenAI' };
  throw new Error('OpenAI image returned no data');
}

async function generateWithHuggingFace(prompt: string, key: string): Promise<GeneratedImage> {
  const response = await fetch('https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ inputs: prompt }),
  });
  if (!response.ok) throw new Error(`Hugging Face image failed (HTTP ${response.status})`);
  const blob = await response.blob();
  const url = await dataUrlFromBlob(blob);
  return { url, providerName: 'Hugging Face FLUX.1' };
}

/**
 * Pollinations fallback — a plain URL, always available, zero key.
 * Displayed directly via <img src>; downloads fetch it through CORS.
 */
export function pollinationsImageUrl(prompt: string, aspect: AspectRatio, seed = Math.floor(Math.random() * 1_000_000)): string {
  const { width, height } = RATIO_DIMENSIONS[aspect];
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true`;
}

export interface ImageGenOptions {
  aspect: AspectRatio;
  openaiKey?: string;
  huggingFaceKey?: string;
  pollinationsConnected?: boolean;
}

export async function generateImage(prompt: string, options: ImageGenOptions): Promise<GeneratedImage> {
  const { aspect, openaiKey, huggingFaceKey, pollinationsConnected = true } = options;

  if (huggingFaceKey) {
    try {
      return await generateWithHuggingFace(prompt, huggingFaceKey);
    } catch {
      // fall through
    }
  }
  if (openaiKey) {
    try {
      return await generateWithOpenAI(prompt, aspect, openaiKey);
    } catch {
      // fall through
    }
  }
  if (pollinationsConnected) {
    return { url: pollinationsImageUrl(prompt, aspect), providerName: 'Pollinations' };
  }
  throw new Error('No image provider connected — enable Pollinations in Connected Apps.');
}

/** Fetch a generated image as a PNG blob URL for downloading. */
export async function downloadImage(url: string, filename: string): Promise<void> {
  const response = await fetch(url);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

// ---------------------------------------------------------------------------
// Narrated Motion Storyboard engine
// ---------------------------------------------------------------------------

interface ScenePlan {
  captionEn: string;
  captionAr: string;
  imagePrompt: string;
}

interface StoryboardPlan {
  titleEn: string;
  titleAr: string;
  scenes: ScenePlan[];
}

interface PlanParserShape {
  titleEn?: string;
  titleAr?: string;
  scenes?: Array<{ captionEn?: string; captionAr?: string; imagePrompt?: string }>;
}

function parseStoryboardPlan(raw: string): StoryboardPlan | null {
  const cleaned = raw.replace(/```(?:json)?/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as PlanParserShape;
    const scenes = (parsed.scenes ?? [])
      .map((s) => ({
        captionEn: s.captionEn ?? '',
        captionAr: s.captionAr ?? '',
        imagePrompt: s.imagePrompt ?? '',
      }))
      .filter((s) => s.imagePrompt.length > 0);
    if (scenes.length === 0) return null;
    return {
      titleEn: parsed.titleEn ?? 'Motion Storyboard',
      titleAr: parsed.titleAr ?? 'لوحة حركة',
      scenes: scenes.slice(0, 6),
    };
  } catch {
    return null;
  }
}

function fallbackPlan(userPrompt: string): StoryboardPlan {
  const sentences = userPrompt
    .split(/[.!؟?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3)
    .slice(0, 5);
  const parts = sentences.length > 0 ? sentences : [userPrompt || 'A cinematic scene'];
  return {
    titleEn: userPrompt.slice(0, 60) || 'Motion Storyboard',
    titleAr: userPrompt.slice(0, 60) || 'لوحة حركة',
    scenes: parts.map((part, i) => ({
      captionEn: part,
      captionAr: part,
      imagePrompt: `${part}, cinematic wide shot, scene ${i + 1} of ${parts.length}, high detail, dramatic lighting`,
    })),
  };
}

const CINEMA_SUFFIX = 'cinematic composition, volumetric lighting, ultra detailed, photorealistic, 8k';

export interface StoryboardOptions extends ImageGenOptions {
  /** Native UI language — captions still generated bilingually. */
  language: 'en' | 'ar';
}

export async function generateStoryboard(
  callLLM: (prompt: string) => Promise<string>,
  userPrompt: string,
  options: StoryboardOptions,
): Promise<Storyboard> {
  const plannerPrompt = [
    'You are a film director. Split the following idea into a narrated motion storyboard of 4 to 6 sequential scenes.',
    'Respond with ONLY minified JSON matching:',
    '{"titleEn":"...","titleAr":"...","scenes":[{"captionEn":"English narration","captionAr":"السرد بالعربية","imagePrompt":"detailed visual description"}]}',
    `Idea: ${userPrompt}`,
    'Language of user idea:',
    options.language === 'ar' ? 'Arabic-first, still provide both captions.' : 'English-first, still provide both captions.',
  ].join('\n');

  let plan: StoryboardPlan | null = null;
  try {
    const raw = await callLLM(plannerPrompt);
    plan = parseStoryboardPlan(raw);
  } catch {
    plan = null;
  }
  const finalPlan = plan ?? fallbackPlan(userPrompt);

  const scenes: StoryboardScene[] = [];
  for (const scenePlan of finalPlan.scenes) {
    const image = await generateImage(`${scenePlan.imagePrompt}, ${CINEMA_SUFFIX}`, options);
    scenes.push({ imageUrl: image.url, captionEn: scenePlan.captionEn, captionAr: scenePlan.captionAr });
  }

  return { titleEn: finalPlan.titleEn, titleAr: finalPlan.titleAr, scenes };
}

// ---------------------------------------------------------------------------
// Standalone HTML export — Ken Burns motion player with subtitles
// ---------------------------------------------------------------------------

interface HtmlEscapeables {
  '&': string;
  '<': string;
  '>': string;
  '"': string;
}

export function storyboardToStandaloneHtml(storyboard: Storyboard, autoplayMs = 5000): string {
  const esc = (s: string): string =>
    s.replace(/[&<>"]/g, (ch: string) => `&#${(ch as keyof HtmlEscapeables).charCodeAt(0)};`);

  const slides = storyboard.scenes
    .map(
      (scene, i) => `
    <div class="slide${i === 0 ? ' active' : ''}" style="background-image:url('${scene.imageUrl}')">
      <div class="caption">
        <p class="en">${esc(scene.captionEn)}</p>
        <p class="ar" dir="rtl">${esc(scene.captionAr)}</p>
      </div>
    </div>`,
    )
    .join('');

  const duration = autoplayMs;
  const total = storyboard.scenes.length * duration;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(storyboard.titleEn)}</title>
<style>
  body{margin:0;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif}
  .player{position:relative;width:min(90vw,960px);aspect-ratio:16/9;overflow:hidden;border-radius:12px}
  .slide{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0;transition:opacity 1s ease;animation:kenburns ${duration}ms linear infinite}
  .slide.active{opacity:1}
  @keyframes kenburns{0%{transform:scale(1) translate(0,0)}100%{transform:scale(1.12) translate(2%, -2%)}}
  .caption{position:absolute;bottom:0;left:0;right:0;padding:20px;background:linear-gradient(transparent,rgba(0,0,0,.85));color:#fff}
  .caption .ar{margin:4px 0 0}
  h1{color:#fff;font-size:1.1rem;margin:12px}
</style>
</head>
<body>
<h1>${esc(storyboard.titleEn)} — ${esc(storyboard.titleAr)}</h1>
<div class="player">${slides}</div>
<script>
  var slides=document.querySelectorAll('.slide');var idx=0;var duration=${duration};
  setInterval(function(){slides[idx].classList.remove('active');idx=(idx+1)%slides.length;slides[idx].classList.add('active');},duration);
  console.log('total ${total}ms');
</script>
</body>
</html>`;
}

export function downloadStandaloneHtml(storyboard: Storyboard): void {
  const html = storyboardToStandaloneHtml(storyboard);
  const blob = new Blob([html], { type: 'text/html' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = 'motion-storyboard.html';
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

// ---------------------------------------------------------------------------
// Web Speech narration (Arabic / French / English)
// ---------------------------------------------------------------------------

export function speakText(text: string, language: 'en' | 'ar' | 'fr'): void {
  if (typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language === 'ar' ? 'ar-SA' : language === 'fr' ? 'fr-FR' : 'en-US';
  utterance.rate = 1;
  speechSynthesis.speak(utterance);
}

export function stopSpeech(): void {
  if (typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();
}
