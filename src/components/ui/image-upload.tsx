import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ImageUploadProps {
  bucket: 'products' | 'banners' | 'categories' | 'store';
  value?: string;
  onChange: (url: string | null) => void;
  folder?: string;
  className?: string;
  aspectRatio?: 'square' | 'video' | 'banner';
  placeholder?: string;
}

export function ImageUpload({
  bucket,
  value,
  onChange,
  folder = '',
  className,
  aspectRatio = 'square',
  placeholder = 'Click to upload image',
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(value || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const aspectClasses = {
    square: 'aspect-square',
    video: 'aspect-video',
    banner: 'aspect-[3/1]',
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a JPEG, PNG, WebP, or GIF image.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 5MB.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      // Create a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${folder ? folder + '/' : ''}${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      const publicUrl = urlData.publicUrl;
      setPreview(publicUrl);
      onChange(publicUrl);

      toast({
        title: 'Upload successful',
        description: 'Image has been uploaded.',
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload image.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    if (value) {
      // Extract file path from URL
      const urlParts = value.split(`/${bucket}/`);
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from(bucket).remove([filePath]);
      }
    }
    setPreview(null);
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={cn('relative', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />

      {preview ? (
        <div className={cn('relative rounded-lg overflow-hidden border border-border', aspectClasses[aspectRatio])}>
          <img
            src={preview}
            alt="Preview"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              Change
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRemove}
              disabled={isUploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className={cn(
            'w-full rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors',
            'flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground',
            aspectClasses[aspectRatio],
            isUploading && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm">Uploading...</span>
            </>
          ) : (
            <>
              <ImageIcon className="h-8 w-8" />
              <span className="text-sm">{placeholder}</span>
              <span className="text-xs text-muted-foreground">JPEG, PNG, WebP, GIF (max 5MB)</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

// Multi-image upload component
interface MultiImageUploadProps {
  bucket: 'products' | 'banners' | 'categories' | 'store';
  values: string[];
  onChange: (urls: string[]) => void;
  folder?: string;
  maxImages?: number;
  className?: string;
}

export function MultiImageUpload({
  bucket,
  values = [],
  onChange,
  folder = '',
  maxImages = 10,
  className,
}: MultiImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (values.length + files.length > maxImages) {
      toast({
        title: 'Too many images',
        description: `Maximum ${maxImages} images allowed.`,
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    const newUrls: string[] = [];

    try {
      for (const file of files) {
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) continue;
        if (file.size > 5 * 1024 * 1024) continue;

        const fileExt = file.name.split('.').pop();
        const fileName = `${folder ? folder + '/' : ''}${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(fileName, file, { cacheControl: '3600', upsert: false });

        if (!error && data) {
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
          newUrls.push(urlData.publicUrl);
        }
      }

      onChange([...values, ...newUrls]);
      toast({ title: 'Upload successful', description: `${newUrls.length} image(s) uploaded.` });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async (index: number) => {
    const url = values[index];
    const urlParts = url.split(`/${bucket}/`);
    if (urlParts.length > 1) {
      await supabase.storage.from(bucket).remove([urlParts[1]]);
    }
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <div className={cn('space-y-3', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />

      <div className="grid grid-cols-4 gap-3">
        {values.map((url, index) => (
          <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
            <img src={url} alt={`Image ${index + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => handleRemove(index)}
              className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {values.length < maxImages && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            {isUploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <Upload className="h-6 w-6" />
                <span className="text-xs mt-1">Add</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
