// ============================================================================
// intentRouter — Automatic multilingual intent detection (Phase 10C)
// Detects image / video / document / web intents from Arabic, French, English
// ============================================================================

export type IntentType = 'image' | 'video' | 'document' | 'web' | 'chat';

export interface IntentResult {
  intent: IntentType;
  urls: string[];
  /** Image intent explicitly asks for real photographs. */
  wantsRealPhotos: boolean;
}

const IMAGE_KEYWORDS = [
  'أنشئ صورة', 'انشئ صورة', 'ارسم', 'صورة', 'رسمة', 'تصميم صورة',
  'generate image', 'generate an image', 'create image', 'draw', 'make an image',
  'génère une image', 'crée une image', 'dessine', 'une image de',
];

const REAL_PHOTO_KEYWORDS = [
  'صورة حقيقية', 'صور حقيقية', 'فوتوغرافية', 'صورة فوتوغرافية',
  'real photo', 'real photos', 'photograph', 'actual photo',
  'photo réelle', 'vraie photo',
];

const VIDEO_KEYWORDS = [
  'فيديو', 'مقطع فيديو', 'أنيميشن', 'انيميشن', 'مقطع متحرك', 'لوحة قصة',
  'create video', 'make a video', 'storyboard', 'motion video', 'animation video',
  'créer une vidéo', 'vidéo', 'story-board',
];

const DOCUMENT_KEYWORDS = [
  'باوربوينت', 'عرض تقديمي', 'بريزنتيشن', 'وورد', 'ملف وورد', 'بي دي اف', 'تقرير', 'درس', 'مذكرة',
  'powerpoint', 'pptx', 'ppt', 'word doc', 'docx', 'word document', 'pdf', 'report', 'lesson plan',
  'powerpoint en', 'présentation', 'document de', 'rapport', 'leçon',
];

const WEB_KEYWORDS = [
  'ابحث', 'ابحث عن', 'أخبار', 'آخر الأخبار', 'أحدث', 'ما هو', 'من هو', 'كم عدد',
  'search the web', 'search for', 'latest', 'news about', 'who is', 'what is', 'how many', 'current',
  'cherche', 'rechercher', 'nouvelles', 'qui est', 'qu est-ce que',
];

const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/g;

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

export function detectIntent(rawText: string): IntentResult {
  const text = rawText.toLowerCase();
  const urls = rawText.match(URL_REGEX) ?? [];

  // A URL always means web reading, regardless of other keywords
  if (urls.length > 0) {
    return { intent: 'web', urls, wantsRealPhotos: false };
  }

  if (includesAny(text, IMAGE_KEYWORDS)) {
    const wantsRealPhotos = includesAny(text, REAL_PHOTO_KEYWORDS);
    return { intent: 'image', urls, wantsRealPhotos };
  }

  if (includesAny(text, VIDEO_KEYWORDS)) {
    return { intent: 'video', urls, wantsRealPhotos: false };
  }

  if (includesAny(text, DOCUMENT_KEYWORDS)) {
    return { intent: 'document', urls, wantsRealPhotos: false };
  }

  if (includesAny(text, WEB_KEYWORDS)) {
    return { intent: 'web', urls, wantsRealPhotos: false };
  }

  return { intent: 'chat', urls, wantsRealPhotos: false };
}

// ---------------------------------------------------------------------------
// Prompt language detection + translation to English visual descriptions
// ---------------------------------------------------------------------------

export type PromptLanguage = 'en' | 'ar' | 'fr';

export function detectPromptLanguage(text: string): PromptLanguage {
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  if (/[àâçéèêëîïôùûüœ]/i.test(text)) return 'fr';
  return 'en';
}

/**
 * Translates non-English image/video prompts into detailed literal English
 * visual descriptions so the visual pipelines match the user's prompt exactly.
 */
export async function translateToEnglishVisualPrompt(
  callLLM: (prompt: string) => Promise<string>,
  prompt: string,
): Promise<string> {
  const language = detectPromptLanguage(prompt);
  if (language === 'en') return prompt;
  try {
    const raw = await callLLM(
      `Translate the following ${language === 'ar' ? 'Arabic' : 'French'} prompt into a detailed, literal English visual description for an image generation model. Keep every detail. Respond with ONLY the English description.\n\nPrompt: ${prompt}`,
    );
    const cleaned = raw.trim().replace(/^["']|["']$/g, '');
    return cleaned.length > 0 ? cleaned : prompt;
  } catch {
    return prompt; // non-fatal — original prompt still renders something
  }
}
