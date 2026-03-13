import type { ImgHTMLAttributes } from 'react';
import { buildResponsiveImageSet } from '@/lib/responsive-image';

type ResponsiveImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> & {
  src: string;
  widths?: number[];
  sizes?: string;
  quality?: number;
};

export function ResponsiveImage({
  src,
  alt,
  widths = [320, 480, 640, 768, 1024],
  sizes = '100vw',
  quality = 72,
  loading = 'lazy',
  decoding = 'async',
  ...imgProps
}: ResponsiveImageProps) {
  const sources = buildResponsiveImageSet(src, widths, quality);

  return (
    <picture>
      {sources.webpSrcSet && <source type="image/webp" srcSet={sources.webpSrcSet} sizes={sizes} />}
      {sources.srcSet && <source srcSet={sources.srcSet} sizes={sizes} />}
      <img
        {...imgProps}
        src={sources.src}
        srcSet={sources.srcSet}
        sizes={sizes}
        alt={alt}
        loading={loading}
        decoding={decoding}
      />
    </picture>
  );
}
