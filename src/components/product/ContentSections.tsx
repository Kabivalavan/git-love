import { memo, useState, useRef, useEffect } from 'react';
import { Separator } from '@/components/ui/separator';
import { Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ContentSection {
  type: 'rich_text' | 'faq' | 'size_guide' | 'ingredients' | 'before_after' | 'spotlight' | 'video';
  title: string;
  content?: string;
  items?: { q: string; a: string }[];
  spotlights?: { name: string; description: string; image_url: string }[];
  before_image?: string;
  after_image?: string;
  video_url?: string;
  video_thumbnail?: string;
  enabled: boolean;
  order: number;
}

interface ContentSectionsProps {
  sections: ContentSection[];
}

const BeforeAfterSlider = memo(function BeforeAfterSlider({ before, after, title }: { before: string; after: string; title: string }) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setPosition((x / rect.width) * 100);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => { if (isDragging.current) handleMove(e.clientX); };
    const onTouchMove = (e: TouchEvent) => { if (isDragging.current) handleMove(e.touches[0].clientX); };
    const onEnd = () => { isDragging.current = false; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchend', onEnd);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[16/9] max-w-2xl mx-auto rounded-xl overflow-hidden cursor-col-resize select-none border border-border"
      onMouseDown={(e) => { isDragging.current = true; handleMove(e.clientX); }}
      onTouchStart={(e) => { isDragging.current = true; handleMove(e.touches[0].clientX); }}
    >
      <img src={after} alt={`${title} - After`} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${position}%` }}>
        <img src={before} alt={`${title} - Before`} className="absolute inset-0 w-full h-full object-cover" style={{ minWidth: containerRef.current?.offsetWidth }} />
      </div>
      <div className="absolute top-0 bottom-0" style={{ left: `${position}%` }}>
        <div className="absolute top-0 bottom-0 -translate-x-1/2 w-0.5 bg-primary" />
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg">
          <span className="text-primary-foreground text-xs font-bold">↔</span>
        </div>
      </div>
      <span className="absolute top-3 left-3 bg-background/80 text-foreground text-xs font-semibold px-2 py-1 rounded">Before</span>
      <span className="absolute top-3 right-3 bg-background/80 text-foreground text-xs font-semibold px-2 py-1 rounded">After</span>
    </div>
  );
});

const VideoEmbed = memo(function VideoEmbed({ url, thumbnail }: { url: string; thumbnail?: string }) {
  const [playing, setPlaying] = useState(false);

  // Convert YouTube URLs to embed
  const getEmbedUrl = (u: string) => {
    const ytMatch = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;
    return u;
  };

  if (playing) {
    return (
      <div className="relative w-full aspect-video max-w-2xl mx-auto rounded-xl overflow-hidden border border-border">
        <iframe src={getEmbedUrl(url)} className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen />
      </div>
    );
  }

  return (
    <div
      className="relative w-full aspect-video max-w-2xl mx-auto rounded-xl overflow-hidden border border-border cursor-pointer group"
      onClick={() => setPlaying(true)}
    >
      {thumbnail ? (
        <img src={thumbnail} alt="Video thumbnail" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-muted flex items-center justify-center">
          <span className="text-muted-foreground text-sm">Click to play video</span>
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
        <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg">
          <Play className="h-6 w-6 text-primary-foreground ml-0.5" />
        </div>
      </div>
    </div>
  );
});

export const ContentSections = memo(function ContentSections({ sections }: ContentSectionsProps) {
  const enabled = sections.filter(s => s.enabled).sort((a, b) => a.order - b.order);
  if (enabled.length === 0) return null;

  return (
    <div className="space-y-8">
      {enabled.map((section, i) => (
        <div key={i}>
          {i > 0 && <Separator className="mb-8" />}
          <div>
            <h2 className="text-lg md:text-xl font-bold text-foreground mb-4">
              {section.title}
            </h2>

            {section.type === 'faq' && section.items ? (
              <div className="space-y-4">
                {section.items.map((item, j) => (
                  <div key={j}>
                    <p className="font-semibold text-sm text-foreground mb-1">{item.q}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                  </div>
                ))}
              </div>
            ) : section.type === 'before_after' && section.before_image && section.after_image ? (
              <BeforeAfterSlider before={section.before_image} after={section.after_image} title={section.title} />
            ) : section.type === 'spotlight' && section.spotlights && section.spotlights.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.spotlights.map((item, j) => (
                  <div key={j} className="border border-border rounded-xl overflow-hidden bg-card">
                    {item.image_url && (
                      <div className="aspect-square bg-muted">
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="font-semibold text-foreground text-sm">{item.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : section.type === 'video' && section.video_url ? (
              <VideoEmbed url={section.video_url} thumbnail={section.video_thumbnail} />
            ) : (
              <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
                {section.content || 'No content available.'}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
});
