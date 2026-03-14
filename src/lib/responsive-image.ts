const SUPABASE_PUBLIC_SEGMENT = '/storage/v1/object/public/';
const SUPABASE_RENDER_SEGMENT = '/storage/v1/render/image/public/';

function getPathFromSupabasePublicUrl(imageUrl: string): { origin: string; path: string } | null {
  try {
    const parsed = new URL(imageUrl);
    const [_, path] = parsed.pathname.split(SUPABASE_PUBLIC_SEGMENT);
    if (!path) return null;
    return { origin: parsed.origin, path };
  } catch {
    return null;
  }
}

export function isSupabasePublicImage(imageUrl: string): boolean {
  return imageUrl.includes(SUPABASE_PUBLIC_SEGMENT);
}

export function buildResponsiveImageSrc(
  imageUrl: string,
  width: number,
  options?: { quality?: number; format?: 'webp' | 'avif' | 'origin' }
): string {
  const quality = options?.quality ?? 72;
  const format = options?.format ?? 'origin';
  const parsed = getPathFromSupabasePublicUrl(imageUrl);

  if (!parsed) return imageUrl;

  const transformed = new URL(`${parsed.origin}${SUPABASE_RENDER_SEGMENT}${parsed.path}`);
  transformed.searchParams.set('width', String(width));
  transformed.searchParams.set('quality', String(quality));

  if (format === 'webp') {
    transformed.searchParams.set('format', 'webp');
  }
  // Note: Supabase Image Transformation doesn't natively support AVIF format parameter yet,
  // but we include it for future-proofing when it does
  if (format === 'avif') {
    transformed.searchParams.set('format', 'avif');
  }

  return transformed.toString();
}

export function buildResponsiveImageSet(
  imageUrl: string,
  widths: number[],
  quality = 72
): { src: string; srcSet?: string; webpSrcSet?: string; avifSrcSet?: string } {
  const sanitizedWidths = [...new Set(widths)].filter(Boolean).sort((a, b) => a - b);
  if (sanitizedWidths.length === 0) {
    return { src: imageUrl };
  }

  if (!isSupabasePublicImage(imageUrl)) {
    return {
      src: imageUrl,
      srcSet: sanitizedWidths.map((w) => `${imageUrl} ${w}w`).join(', '),
    };
  }

  const srcSet = sanitizedWidths
    .map((w) => `${buildResponsiveImageSrc(imageUrl, w, { quality, format: 'origin' })} ${w}w`)
    .join(', ');

  const webpSrcSet = sanitizedWidths
    .map((w) => `${buildResponsiveImageSrc(imageUrl, w, { quality, format: 'webp' })} ${w}w`)
    .join(', ');

  const avifSrcSet = sanitizedWidths
    .map((w) => `${buildResponsiveImageSrc(imageUrl, w, { quality, format: 'avif' })} ${w}w`)
    .join(', ');

  return {
    src: buildResponsiveImageSrc(imageUrl, sanitizedWidths[sanitizedWidths.length - 1], {
      quality,
      format: 'origin',
    }),
    srcSet,
    webpSrcSet,
    avifSrcSet,
  };
}
