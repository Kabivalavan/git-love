import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUpload } from '@/components/ui/image-upload';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import type { ContentSection } from './ContentSections';

interface ContentSectionsEditorProps {
  sections: ContentSection[];
  onChange: (sections: ContentSection[]) => void;
}

const SECTION_TYPES = [
  { value: 'rich_text', label: 'Rich Text' },
  { value: 'faq', label: 'FAQ' },
  { value: 'size_guide', label: 'Size Guide' },
  { value: 'ingredients', label: 'Ingredients / Materials' },
  { value: 'before_after', label: 'Before & After' },
  { value: 'spotlight', label: 'Spotlight Cards' },
  { value: 'video', label: 'Video Embed' },
];

export function ContentSectionsEditor({ sections, onChange }: ContentSectionsEditorProps) {
  const addSection = () => {
    onChange([...sections, {
      type: 'rich_text',
      title: 'Details',
      content: '',
      items: [],
      spotlights: [],
      enabled: true,
      order: sections.length,
    }]);
  };

  const updateSection = (idx: number, updates: Partial<ContentSection>) => {
    const updated = [...sections];
    updated[idx] = { ...updated[idx], ...updates };
    onChange(updated);
  };

  const removeSection = (idx: number) => {
    onChange(sections.filter((_, i) => i !== idx));
  };

  // FAQ helpers
  const addFaqItem = (idx: number) => {
    const s = { ...sections[idx] };
    s.items = [...(s.items || []), { q: '', a: '' }];
    const updated = [...sections];
    updated[idx] = s;
    onChange(updated);
  };

  const updateFaqItem = (sIdx: number, fIdx: number, field: 'q' | 'a', value: string) => {
    const s = { ...sections[sIdx] };
    const items = [...(s.items || [])];
    items[fIdx] = { ...items[fIdx], [field]: value };
    s.items = items;
    const updated = [...sections];
    updated[sIdx] = s;
    onChange(updated);
  };

  const removeFaqItem = (sIdx: number, fIdx: number) => {
    const s = { ...sections[sIdx] };
    s.items = (s.items || []).filter((_, i) => i !== fIdx);
    const updated = [...sections];
    updated[sIdx] = s;
    onChange(updated);
  };

  // Spotlight helpers
  const addSpotlight = (idx: number) => {
    const s = { ...sections[idx] };
    s.spotlights = [...(s.spotlights || []), { name: '', description: '', image_url: '' }];
    const updated = [...sections];
    updated[idx] = s;
    onChange(updated);
  };

  const updateSpotlight = (sIdx: number, spIdx: number, field: string, value: string) => {
    const s = { ...sections[sIdx] };
    const spotlights = [...(s.spotlights || [])];
    spotlights[spIdx] = { ...spotlights[spIdx], [field]: value };
    s.spotlights = spotlights;
    const updated = [...sections];
    updated[sIdx] = s;
    onChange(updated);
  };

  const removeSpotlight = (sIdx: number, spIdx: number) => {
    const s = { ...sections[sIdx] };
    s.spotlights = (s.spotlights || []).filter((_, i) => i !== spIdx);
    const updated = [...sections];
    updated[sIdx] = s;
    onChange(updated);
  };

  const renderSectionBody = (section: ContentSection, idx: number) => {
    switch (section.type) {
      case 'faq':
        return (
          <div className="space-y-2 pl-6">
            {(section.items || []).map((item, fIdx) => (
              <div key={fIdx} className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Input value={item.q} onChange={(e) => updateFaqItem(idx, fIdx, 'q', e.target.value)} placeholder="Question" className="h-8 text-sm" />
                  <Input value={item.a} onChange={(e) => updateFaqItem(idx, fIdx, 'a', e.target.value)} placeholder="Answer" className="h-8 text-sm" />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeFaqItem(idx, fIdx)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addFaqItem(idx)}><Plus className="h-3 w-3 mr-1" /> Add Q&A</Button>
          </div>
        );

      case 'before_after':
        return (
          <div className="space-y-3 pl-6">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Before Image</Label>
              <ImageUpload
                bucket="products"
                value={section.before_image || ''}
                onChange={(url) => updateSection(idx, { before_image: url || '' })}
                folder="content-sections"
                aspectRatio="video"
                placeholder="Upload before image"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">After Image</Label>
              <ImageUpload
                bucket="products"
                value={section.after_image || ''}
                onChange={(url) => updateSection(idx, { after_image: url || '' })}
                folder="content-sections"
                aspectRatio="video"
                placeholder="Upload after image"
              />
            </div>
          </div>
        );

      case 'spotlight':
        return (
          <div className="space-y-2 pl-6">
            {(section.spotlights || []).map((sp, spIdx) => (
              <div key={spIdx} className="border border-border rounded-lg p-3 space-y-1.5">
                <div className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1.5">
                    <Input value={sp.name} onChange={(e) => updateSpotlight(idx, spIdx, 'name', e.target.value)} placeholder="Name (e.g. Vitamin C)" className="h-8 text-sm" />
                    <ImageUpload
                      bucket="products"
                      value={sp.image_url || ''}
                      onChange={(url) => updateSpotlight(idx, spIdx, 'image_url', url || '')}
                      folder="content-sections"
                      aspectRatio="square"
                      placeholder="Upload spotlight image"
                    />
                    <Textarea value={sp.description} onChange={(e) => updateSpotlight(idx, spIdx, 'description', e.target.value)} placeholder="Description" rows={2} className="text-sm" />
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => removeSpotlight(idx, spIdx)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addSpotlight(idx)}><Plus className="h-3 w-3 mr-1" /> Add Card</Button>
          </div>
        );

      case 'video':
        return (
          <div className="space-y-2 pl-6">
            <div>
              <Label className="text-xs text-muted-foreground">Video URL (YouTube or direct)</Label>
              <Input value={section.video_url || ''} onChange={(e) => updateSection(idx, { video_url: e.target.value })} placeholder="https://youtube.com/watch?v=..." className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Thumbnail URL (optional)</Label>
              <Input value={section.video_thumbnail || ''} onChange={(e) => updateSection(idx, { video_thumbnail: e.target.value })} placeholder="https://... thumbnail image" className="h-8 text-sm" />
            </div>
          </div>
        );

      default:
        return (
          <Textarea
            value={section.content || ''}
            onChange={(e) => updateSection(idx, { content: e.target.value })}
            rows={3}
            placeholder={
              section.type === 'size_guide' ? 'Enter size chart or measurements...' :
              section.type === 'ingredients' ? 'List ingredients, materials, or composition...' :
              'Enter content...'
            }
            className="ml-6"
          />
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Content Sections</Label>
        <Button variant="outline" size="sm" onClick={addSection}>
          <Plus className="h-4 w-4 mr-1" /> Add Section
        </Button>
      </div>

      {sections.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
          No content sections. Add FAQ, Size Guide, Spotlight, Video, or custom content.
        </p>
      )}

      {sections.map((section, idx) => (
        <div key={idx} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <Select
              value={section.type}
              onValueChange={(v) => updateSection(idx, { type: v as ContentSection['type'], title: section.title === (SECTION_TYPES.find(t => t.value === section.type)?.label || '') ? (SECTION_TYPES.find(t => t.value === v)?.label || section.title) : section.title })}
            >
              <SelectTrigger className="w-44 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SECTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              value={section.title}
              onChange={(e) => updateSection(idx, { title: e.target.value })}
              className="flex-1 h-8"
              placeholder="Section title (customisable)"
            />
            <Switch
              checked={section.enabled}
              onCheckedChange={(c) => updateSection(idx, { enabled: c })}
            />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeSection(idx)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {renderSectionBody(section, idx)}
        </div>
      ))}
    </div>
  );
}
