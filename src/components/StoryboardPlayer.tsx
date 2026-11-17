// ============================================================================
// StoryboardPlayer — Ken Burns motion player inside assistant bubbles (10B)
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Download } from 'lucide-react';
import type { Translation } from '@/lib/i18n';
import type { Storyboard } from '@/lib/mediaGenerator';
import { downloadStandaloneHtml, speakText, stopSpeech } from '@/lib/mediaGenerator';

interface StoryboardPlayerProps {
  t: Translation;
  dir: 'rtl' | 'ltr';
  language: 'en' | 'ar';
  storyboard: Storyboard;
}

const SCENE_DURATION_MS = 5000;

export function StoryboardPlayer({ t, dir, language, storyboard }: StoryboardPlayerProps) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [narration, setNarration] = useState(false);
  const timerRef = useRef<number | null>(null);

  const scene = storyboard.scenes[index];

  const advance = useCallback(() => {
    setIndex((prev) => (prev + 1) % storyboard.scenes.length);
  }, [storyboard.scenes.length]);

  useEffect(() => {
    if (!playing) return;
    timerRef.current = window.setInterval(advance, SCENE_DURATION_MS);
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [playing, advance]);

  // Speak the caption whenever narration is on and the scene changes
  useEffect(() => {
    if (!narration || !scene) return;
    speakText(language === 'ar' ? scene.captionAr : scene.captionEn, language);
    return () => stopSpeech();
  }, [narration, scene, language]);

  const handleToggleNarration = () => {
    setNarration((prev) => {
      if (prev) stopSpeech();
      return !prev;
    });
  };

  if (!scene) return null;
  const caption = language === 'ar' ? scene.captionAr : scene.captionEn;

  return (
    <div dir={dir} className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-950 max-w-full">
      {/* Motion frame — CSS Ken Burns zoom/pan */}
      <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
        {storyboard.scenes.map((s, i) => (
          <div
            key={i}
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${i === index ? 'opacity-100' : 'opacity-0'}`}
            style={{
              backgroundImage: `url(${s.imageUrl})`,
              animation: i === index ? `omnifree-kenburns ${SCENE_DURATION_MS}ms linear forwards` : undefined,
            }}
          />
        ))}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2.5 pt-8">
          <p className="text-white text-sm leading-snug drop-shadow">{caption}</p>
          <p className="text-neutral-300 text-xs mt-0.5" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            {language === 'ar' ? scene.captionEn : scene.captionAr}
          </p>
        </div>
        <div className="absolute top-2 end-2 rounded-full bg-black/60 text-white text-xs px-2 py-0.5 tabular-nums">
          {t.sceneOf} {index + 1}/{storyboard.scenes.length}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 bg-neutral-900 px-3 py-2">
        <button
          onClick={() => setPlaying((p) => !p)}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          aria-label={playing ? t.pause : t.play}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button
          onClick={handleToggleNarration}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
            narration ? 'bg-primary-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
          }`}
          aria-label={narration ? t.narrationOff : t.narrationOn}
        >
          {narration ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
        <div className="flex-1 flex gap-1">
          {storyboard.scenes.map((_, i) => (
            <button
              key={i}
              onClick={() => { setIndex(i); setPlaying(true); }}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i === index ? 'bg-primary-400' : 'bg-white/20 hover:bg-white/40'}`}
              aria-label={`${t.sceneOf} ${i + 1}`}
            />
          ))}
        </div>
        <button
          onClick={() => downloadStandaloneHtml(storyboard)}
          className="inline-flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 text-xs font-medium transition-colors flex-shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          {t.downloadHtml}
        </button>
      </div>
      <p className="bg-neutral-900 px-3 pb-2 text-xs text-neutral-400 truncate">
        {language === 'ar' ? storyboard.titleAr : storyboard.titleEn}
      </p>
    </div>
  );
}
