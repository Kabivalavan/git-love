import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type StorefrontTheme = 'default' | 'minimal' | 'elegant' | 'playful' | 'bold' | 'nature' | 'tech' | 'sunset' | 'ocean';

interface ThemeContextType {
  theme: StorefrontTheme;
  setTheme: (theme: StorefrontTheme) => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'default',
  setTheme: () => {},
  isLoading: true,
});

export const THEME_OPTIONS: { value: StorefrontTheme; label: string; description: string; colors: string[] }[] = [
  { value: 'default', label: 'Zoho Classic', description: 'Clean blue & white professional design', colors: ['#3B82F6', '#FFFFFF', '#F1F5F9'] },
  { value: 'minimal', label: 'Minimal Clean', description: 'White space, subtle borders, simple typography', colors: ['#18181B', '#FFFFFF', '#F5F5F5'] },
  { value: 'elegant', label: 'Elegant Luxury', description: 'Dark tones with gold accents', colors: ['#C9963B', '#1A1611', '#2A241C'] },
  { value: 'playful', label: 'Playful Modern', description: 'Rounded shapes, gradients, vibrant colors', colors: ['#8B5CF6', '#FBBFCB', '#B2F5EA'] },
  { value: 'bold', label: 'Bold Vibrant', description: 'Strong colors, dynamic dark layout', colors: ['#E11D48', '#1E293B', '#334155'] },
  { value: 'nature', label: 'Nature Organic', description: 'Earthy greens and warm neutrals', colors: ['#16A34A', '#F7F5F0', '#E8E4DB'] },
  { value: 'tech', label: 'Tech Sleek', description: 'Dark cyber theme with electric blue', colors: ['#0EA5E9', '#0F172A', '#1E293B'] },
  { value: 'sunset', label: 'Warm Sunset', description: 'Warm oranges and terracotta tones', colors: ['#EA580C', '#FDF5F0', '#FDE8D8'] },
  { value: 'ocean', label: 'Ocean Breeze', description: 'Cool teal and aqua ocean vibes', colors: ['#0891B2', '#F0FDFA', '#E0F7FA'] },
];

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<StorefrontTheme>('default');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTheme();
  }, []);

  useEffect(() => {
    if (theme !== 'default') {
      document.documentElement.setAttribute('data-storefront-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-storefront-theme');
    }
  }, [theme]);

  const fetchTheme = async () => {
    const { data } = await supabase
      .from('store_settings')
      .select('value')
      .eq('key', 'storefront_theme')
      .single();
    if (data?.value) {
      const val = data.value as { theme: StorefrontTheme };
      setThemeState(val.theme || 'default');
    }
    setIsLoading(false);
  };

  const setTheme = async (newTheme: StorefrontTheme) => {
    setThemeState(newTheme);

    const { data: existing } = await supabase
      .from('store_settings')
      .select('id')
      .eq('key', 'storefront_theme')
      .single();

    if (existing) {
      await supabase
        .from('store_settings')
        .update({ value: { theme: newTheme } as any })
        .eq('key', 'storefront_theme');
    } else {
      await supabase
        .from('store_settings')
        .insert({ key: 'storefront_theme', value: { theme: newTheme } as any });
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useStorefrontTheme = () => useContext(ThemeContext);
