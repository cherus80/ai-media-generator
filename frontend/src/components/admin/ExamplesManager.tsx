import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  getAdminExamples,
  createExample,
  updateExample,
  deleteExample,
  uploadExampleImage,
  getExampleSeoSuggestions,
  getExampleVariantReport,
} from '../../api/admin';
import { getExampleTags } from '../../api/content';
import { FileUpload } from '../common/FileUpload';
import type {
  GenerationExampleAdminItem,
  GenerationExampleVariantReportResponse,
  GenerationExampleSeoSuggestionVariant,
} from '../../types/content';
import { getUploadErrorMessage } from '../../utils/uploadErrors';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const PUBLIC_SITE_BASE_URL = (
  import.meta.env.VITE_PUBLIC_SITE_URL ||
  API_BASE_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'https://ai-generator.mix4.ru')
).replace(/\/$/, '');

const resolveImageUrl = (url: string) =>
  url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;

const getPublicExampleShortUrl = (id: number): string =>
  `${PUBLIC_SITE_BASE_URL}/e/${id}`;

const copyTextToClipboard = async (value: string): Promise<void> => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard API unavailable');
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!copied) {
    throw new Error('Copy command failed');
  }
};

interface DraftExample extends GenerationExampleAdminItem {
  draftSlug: string;
  draftTitle: string;
  draftDescription: string;
  draftPrompt: string;
  draftImageUrl: string;
  draftSeoTitle: string;
  draftSeoDescription: string;
  draftTags: string[];
  draftPublished: boolean;
}

const CYRILLIC_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

const toSlug = (value: string): string => {
  const source = value.trim().toLowerCase();
  if (!source) {
    return '';
  }
  const transliterated = source
    .split('')
    .map((char) => CYRILLIC_MAP[char] ?? char)
    .join('');
  return transliterated
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 240);
};

const truncate = (value: string, max: number): string => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return normalized.slice(0, max - 1).trimEnd() + '…';
};

const hasCyrillic = (value: string): boolean => /[А-Яа-яЁё]/.test(value || '');

const russianRatio = (value: string): number => {
  const cyr = (value.match(/[А-Яа-яЁё]/g) || []).length;
  const lat = (value.match(/[A-Za-z]/g) || []).length;
  const letters = cyr + lat;
  return letters === 0 ? 1 : cyr / letters;
};

const isMostlyRussian = (value: string, minRatio = 0.65): boolean =>
  Boolean(value) && hasCyrillic(value) && russianRatio(value) >= minRatio;

const containsAny = (text: string, keywords: string[]): boolean =>
  keywords.some((keyword) => text.includes(keyword));

const extractPromptHighlightsRu = (prompt: string, maxItems = 4): string[] => {
  const lowered = (prompt || '').toLowerCase();
  const rules: Array<{ keys: string[]; label: string }> = [
    { keys: ['keyhole', 'замочная скважина'], label: 'фон в форме keyhole' },
    { keys: ['bow', 'arrow', 'лук', 'стрела'], label: 'поза с луком и стрелой' },
    { keys: ['full-length', 'full length', 'в полный рост'], label: 'кадр в полный рост' },
    { keys: ['symmetrical', 'symmetry', 'симметр'], label: 'строгая симметричная композиция' },
    { keys: ['couture', '3d roses', 'rose dress', 'платье с розами'], label: 'кутюрный образ с объёмными розами' },
    { keys: ['studio lighting', 'studio', 'студийный свет'], label: 'профессиональный студийный свет' },
    { keys: ['fashion editorial', 'luxury fashion', 'editorial', 'fashion'], label: 'стиль luxury fashion editorial' },
    { keys: ['minimalist', 'минималист'], label: 'минималистичная сценография' },
    { keys: ['red', 'scarlet', 'crimson', 'красн'], label: 'насыщенная красная палитра' },
  ];

  const highlights = rules
    .filter((rule) => containsAny(lowered, rule.keys))
    .map((rule) => rule.label);

  const unique: string[] = [];
  highlights.forEach((item) => {
    if (!unique.includes(item)) {
      unique.push(item);
    }
  });
  return unique.slice(0, maxItems);
};

const inferRuThemeFromPrompt = (prompt: string): string => {
  const lowered = (prompt || '').toLowerCase();
  const isFashion = containsAny(lowered, ['fashion', 'editorial', 'couture', 'outfit', 'стиль']);
  const isStudio = containsAny(lowered, ['studio', 'lighting', 'студ']);
  const hasBow = containsAny(lowered, ['bow', 'arrow', 'лук', 'стрела']);
  const hasKeyhole = containsAny(lowered, ['keyhole', 'замочная скважина']);
  const hasRed = containsAny(lowered, ['red', 'scarlet', 'crimson', 'красн']);
  const hasCouture = containsAny(lowered, ['couture', '3d roses', 'rose dress', 'роз']);

  if (isStudio && isFashion && hasBow) {
    return 'Студийная fashion-съёмка с луком';
  }
  if (isStudio && isFashion && hasKeyhole) {
    return 'Fashion-съёмка в keyhole-сцене';
  }
  if (isFashion && hasCouture && hasRed) {
    return 'Кутюрный красный fashion-образ';
  }
  if (isStudio && hasRed) {
    return 'Красная студийная фотосцена';
  }

  const rules: Array<{ keys: string[]; title: string }> = [
    { keys: ['christmas', 'new year', 'santa', 'holiday'], title: 'Праздничный зимний портрет' },
    { keys: ['winter', 'snow', 'snowy'], title: 'Зимний портрет' },
    { keys: ['selfie', 'phone', 'camera angle'], title: 'Портрет с эффектом селфи' },
    { keys: ['face', 'identity', 'preserve'], title: 'Портрет с сохранением черт лица' },
    { keys: ['fashion', 'style', 'outfit'], title: 'Модный образ' },
    { keys: ['outdoor', 'street'], title: 'Уличная фотосцена' },
    { keys: ['studio', 'lighting'], title: 'Студийный портрет' },
    { keys: ['cinematic', 'movie'], title: 'Кинематографичный портрет' },
  ];

  const found = rules.find((rule) => rule.keys.some((key) => lowered.includes(key)));
  return found?.title || 'AI генерация по фото';
};

const toDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const extractTitleFromPrompt = (prompt: string): string => {
  const cleaned = prompt
    .replace(/[`"'«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) {
    return 'Пример генерации';
  }
  if (!isMostlyRussian(cleaned, 0.55)) {
    return inferRuThemeFromPrompt(cleaned);
  }
  const words = cleaned.split(' ').slice(0, 7).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const buildTitleVariantsFromPrompt = (prompt: string): [string, string, string] => {
  const baseTitle = extractTitleFromPrompt(prompt);
  const variants = [
    baseTitle,
    truncate(`${baseTitle} — сценарий AI-генерации`, 200),
    truncate(`${baseTitle} — пример генерации по фото`, 200),
  ];
  const unique = variants.map((item, index) => {
    const normalized = item.trim() || `Пример генерации ${index + 1}`;
    return normalized.length <= 200 ? normalized : truncate(normalized, 200);
  });
  return [unique[0], unique[1], unique[2]];
};

const buildSeoDraft = (params: {
  title: string;
  prompt: string;
  tags: string[];
  description: string;
  seoTitle: string;
  seoDescription: string;
  slug: string;
}) => {
  const baseTitle = extractTitleFromPrompt(params.prompt);
  const highlights = extractPromptHighlightsRu(params.prompt, 3);
  const highlightsText = highlights.join(', ');
  const firstRuTag = params.tags.find((tag) => isMostlyRussian(tag, 0.5));
  const firstTag = firstRuTag ? `, ${firstRuTag}` : '';
  const generatedDescription = `Пример "${baseTitle}" для AI генерации${firstTag}. ${
    highlightsText
      ? `Ключевые детали: ${highlightsText}.`
      : 'Сценарий уже оптимизирован для быстрого старта и качественного результата.'
  } Загрузите свои фото и получите результат в этом стиле.`;
  const generatedSeoTitle = truncate(`${baseTitle} | Пример генерации AI`, 120);
  const generatedSeoDescription = truncate(
    params.seoDescription.trim() ||
      `Готовый пример "${baseTitle}": загрузите исходник и получите релевантный результат в выбранном стиле.`,
    200
  );
  const generatedSlug = params.slug.trim() || toSlug(baseTitle);

  return {
    slug: generatedSlug,
    description: params.description.trim() || generatedDescription,
    seoTitle: params.seoTitle.trim() || generatedSeoTitle,
    seoDescription: params.seoDescription.trim() || generatedSeoDescription,
  };
};

const buildLocalSeoVariants = (params: {
  title: string;
  prompt: string;
  tags: string[];
  description: string;
  seoTitle: string;
  seoDescription: string;
  slug: string;
}): GenerationExampleSeoSuggestionVariant[] => {
  const base = buildSeoDraft(params);
  const highlights = extractPromptHighlightsRu(params.prompt, 3);
  const highlightsText = highlights.join(', ');
  const [titleA, titleB, titleC] = buildTitleVariantsFromPrompt(params.prompt);
  const baseSlug = base.slug || 'example';
  const variants: GenerationExampleSeoSuggestionVariant[] = [
    {
      slug: baseSlug,
      title: titleA,
      description: base.description,
      seo_title: base.seoTitle,
      seo_description: base.seoDescription,
      faq: [],
    },
    {
      slug: `${baseSlug}-variant-2`,
      title: titleB,
      description: truncate(
        `Карточка "${titleB}" подготовлена для публикации в соцсетях и быстрых креативов по фото.${
          highlightsText ? ` Ключевые детали: ${highlightsText}.` : ''
        }`,
        400
      ),
      seo_title: truncate(`${titleB} | Генерация по промпту`, 120),
      seo_description: truncate(
        `Сценарий "${titleB}" для релевантной генерации: загрузите фото и примените идею карточки.`,
        200
      ),
      faq: [],
    },
    {
      slug: `${baseSlug}-variant-3`,
      title: titleC,
      description: truncate(
        `Вариант "${titleC}" ориентирован на коммерческие визуалы и рекламные публикации.${
          highlightsText ? ` Ключевые детали: ${highlightsText}.` : ''
        }`,
        400
      ),
      seo_title: truncate(`${titleC} | AI пример для генерации`, 120),
      seo_description: truncate(
        `Карточка "${titleC}" с SEO-описанием и CTA для запуска генерации по вашему фото.`,
        200
      ),
      faq: [],
    },
  ];

  return variants.map((variant, index) => ({
    ...variant,
    slug: toSlug(variant.slug) || `example-${index + 1}`,
  }));
};

const clampVariantIndex = (index: number, size: number): number => {
  if (size <= 0) {
    return 0;
  }
  return Math.min(Math.max(index, 0), size - 1);
};

const normalizeSeoVariants = (
  variants: GenerationExampleSeoSuggestionVariant[] | undefined,
  fallback: GenerationExampleSeoSuggestionVariant[]
): GenerationExampleSeoSuggestionVariant[] => {
  const source = variants && variants.length > 0 ? variants : fallback;
  const normalized = source.slice(0, 3).map((variant, index) => ({
    slug: toSlug(variant.slug) || fallback[index]?.slug || `example-${index + 1}`,
    title: truncate(variant.title || fallback[index]?.title || 'Пример генерации', 200),
    description: truncate(variant.description || fallback[index]?.description || 'Пример генерации AI.', 400),
    seo_title: truncate(variant.seo_title || fallback[index]?.seo_title || 'Пример генерации AI', 120),
    seo_description: truncate(
      variant.seo_description || fallback[index]?.seo_description || 'Пример генерации AI',
      200
    ),
    faq: Array.isArray(variant.faq) ? variant.faq : [],
  }));

  return normalized.length > 0 ? normalized : fallback.slice(0, 3);
};

interface TagMultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}

const TagMultiSelect: React.FC<TagMultiSelectProps> = ({ label, options, selected, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return options;
    }
    return options.filter((tag) => tag.includes(normalized));
  }, [options, query]);

  const toggleTag = (tag: string) => {
    if (selected.includes(tag)) {
      onChange(selected.filter((item) => item !== tag));
      return;
    }
    onChange([...selected, tag]);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-gray-600">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="w-full border rounded-lg px-3 py-2 text-sm flex items-center justify-between bg-white"
        >
          <span className="text-gray-700">
            {selected.length > 0 ? `Выбрано: ${selected.length}` : 'Выберите метки'}
          </span>
          <span className="text-gray-400">{isOpen ? '▲' : '▼'}</span>
        </button>

        {isOpen && (
          <div className="absolute z-20 mt-2 w-full rounded-lg border bg-white shadow-lg p-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск меток..."
              className="w-full border rounded-md px-2 py-1 text-xs"
            />
            <div className="mt-2 max-h-48 overflow-y-auto space-y-2">
              {filteredOptions.length === 0 && (
                <div className="text-xs text-gray-400">Ничего не найдено</div>
              )}
              {filteredOptions.map((tag) => (
                <label key={tag} className="flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={selected.includes(tag)}
                    onChange={() => toggleTag(tag)}
                  />
                  <span>{tag}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((tag) => (
            <button
              key={`selected-${tag}`}
              type="button"
              onClick={() => toggleTag(tag)}
              className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
              title="Удалить метку"
            >
              {tag} ✕
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const ExamplesManager: React.FC = () => {
  const [items, setItems] = useState<DraftExample[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [uploadingId, setUploadingId] = useState<number | 'new' | null>(null);
  const [seoGeneratingId, setSeoGeneratingId] = useState<number | 'new' | null>(null);

  const [newSlug, setNewSlug] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newSeoTitle, setNewSeoTitle] = useState('');
  const [newSeoDescription, setNewSeoDescription] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newPublished, setNewPublished] = useState(true);
  const [existingTags, setExistingTags] = useState<string[]>([]);
  const [selectedExistingTags, setSelectedExistingTags] = useState<string[]>([]);
  const [newSeoVariants, setNewSeoVariants] = useState<GenerationExampleSeoSuggestionVariant[]>([]);
  const [newSelectedVariantIndex, setNewSelectedVariantIndex] = useState(0);
  const [itemSeoVariants, setItemSeoVariants] = useState<Record<number, GenerationExampleSeoSuggestionVariant[]>>({});
  const [itemSelectedVariantIndex, setItemSelectedVariantIndex] = useState<Record<number, number>>({});
  const [reportSource, setReportSource] = useState('all');
  const [reportDateFrom, setReportDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return toDateInputValue(date);
  });
  const [reportDateTo, setReportDateTo] = useState(() => toDateInputValue(new Date()));
  const [reportLoading, setReportLoading] = useState(false);
  const [variantReport, setVariantReport] = useState<GenerationExampleVariantReportResponse | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await getAdminExamples();
      const mappedItems = response.items.map((item) => ({
        ...item,
        draftSlug: item.slug || '',
        draftTitle: item.title || '',
        draftDescription: item.description || '',
        draftPrompt: item.prompt,
        draftImageUrl: item.image_url,
        draftSeoTitle: item.seo_title || '',
        draftSeoDescription: item.seo_description || '',
        draftTags: item.tags || [],
        draftPublished: item.is_published,
      }));
      setItems(mappedItems);
      setItemSeoVariants({});
      setItemSelectedVariantIndex(
        Object.fromEntries(mappedItems.map((item) => [item.id, item.seo_variant_index ?? 0]))
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Не удалось загрузить примеры');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const loadTags = async () => {
    try {
      const response = await getExampleTags();
      const tags = response.items.map((item) => item.tag);
      setExistingTags(tags);
    } catch {
      // Не блокируем UI если метки не загрузились
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  const loadVariantReport = async () => {
    if (reportDateFrom && reportDateTo && reportDateFrom > reportDateTo) {
      toast.error('Дата "с" не может быть больше даты "по"');
      return;
    }
    setReportLoading(true);
    try {
      const report = await getExampleVariantReport({
        source: reportSource !== 'all' ? reportSource : undefined,
        date_from: reportDateFrom || undefined,
        date_to: reportDateTo || undefined,
        limit: 200,
      });
      setVariantReport(report);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Не удалось загрузить A/B отчет');
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    loadVariantReport();
  }, []);

  const handleUpload = async (file: File, target: number | 'new') => {
    setUploadingId(target);
    try {
      const uploaded = await uploadExampleImage(file);
      if (target === 'new') {
        setNewImageUrl(uploaded.file_url);
      } else {
        setItems((prev) =>
          prev.map((row) =>
            row.id === target ? { ...row, draftImageUrl: uploaded.file_url } : row
          )
        );
      }
      toast.success('Изображение загружено');
    } catch (err: any) {
      toast.error(
        getUploadErrorMessage(err, {
          kind: 'image',
          maxSizeMb: 10,
          allowedTypesLabel: 'JPEG, PNG, WebP, HEIC/HEIF, MPO',
          fallback: 'Не удалось загрузить изображение. Попробуйте еще раз.',
        })
      );
    } finally {
      setUploadingId(null);
    }
  };

  const handleCreate = async () => {
    if (!newPrompt.trim() || !newImageUrl.trim()) {
      toast.error('Заполните промпт и загрузите изображение');
      return;
    }
    try {
      const parsedTags = normalizeTagList([...selectedExistingTags, ...parseTags(newTags)]);
      const created = await createExample({
        slug: newSlug.trim() || null,
        seo_variant_index: newSelectedVariantIndex,
        title: newTitle.trim() || null,
        description: newDescription.trim() || null,
        prompt: newPrompt.trim(),
        image_url: newImageUrl.trim(),
        seo_title: newSeoTitle.trim() || null,
        seo_description: newSeoDescription.trim() || null,
        tags: parsedTags,
        is_published: newPublished,
      });
      await loadTags();
      setItems((prev) => [
        {
          ...created,
          draftSlug: created.slug || '',
          draftTitle: created.title || '',
          draftDescription: created.description || '',
          draftPrompt: created.prompt,
          draftImageUrl: created.image_url,
          draftSeoTitle: created.seo_title || '',
          draftSeoDescription: created.seo_description || '',
          draftTags: created.tags || [],
          draftPublished: created.is_published,
        },
        ...prev,
      ]);
      setItemSelectedVariantIndex((prev) => ({
        ...prev,
        [created.id]: created.seo_variant_index ?? newSelectedVariantIndex,
      }));
      setNewSlug('');
      setNewTitle('');
      setNewDescription('');
      setNewPrompt('');
      setNewImageUrl('');
      setNewSeoTitle('');
      setNewSeoDescription('');
      setNewTags('');
      setSelectedExistingTags([]);
      setNewPublished(true);
      setNewSeoVariants([]);
      setNewSelectedVariantIndex(0);
      loadVariantReport().catch(() => undefined);
      toast.success(
        created.is_published
          ? 'Пример добавлен и опубликован'
          : 'Пример добавлен как черновик (не виден пользователям)'
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Не удалось добавить пример');
    }
  };

  const handleSave = async (item: DraftExample) => {
    setSavingId(item.id);
    const selectedVariantIndex = itemSelectedVariantIndex[item.id] ?? item.seo_variant_index ?? 0;
    try {
      const updated = await updateExample(item.id, {
        slug: item.draftSlug.trim() || null,
        seo_variant_index: selectedVariantIndex,
        title: item.draftTitle.trim() || null,
        description: item.draftDescription.trim() || null,
        prompt: item.draftPrompt.trim(),
        image_url: item.draftImageUrl.trim(),
        seo_title: item.draftSeoTitle.trim() || null,
        seo_description: item.draftSeoDescription.trim() || null,
        tags: item.draftTags,
        is_published: item.draftPublished,
      });
      await loadTags();
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? {
                ...updated,
                draftSlug: updated.slug || '',
                draftTitle: updated.title || '',
                draftDescription: updated.description || '',
                draftPrompt: updated.prompt,
                draftImageUrl: updated.image_url,
                draftSeoTitle: updated.seo_title || '',
                draftSeoDescription: updated.seo_description || '',
                draftTags: updated.tags || [],
                draftPublished: updated.is_published,
              }
            : row
        )
      );
      setItemSelectedVariantIndex((prev) => ({
        ...prev,
        [item.id]: updated.seo_variant_index ?? selectedVariantIndex,
      }));
      loadVariantReport().catch(() => undefined);
      toast.success(
        updated.is_published
          ? 'Сохранено и опубликовано'
          : 'Сохранено как черновик (не виден пользователям)'
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Не удалось сохранить');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (item: DraftExample) => {
    if (!window.confirm(`Удалить пример "${item.title || item.prompt.slice(0, 20)}"?`)) {
      return;
    }
    setSavingId(item.id);
    try {
      await deleteExample(item.id);
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      setItemSeoVariants((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      setItemSelectedVariantIndex((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      loadVariantReport().catch(() => undefined);
      toast.success('Пример удален');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Не удалось удалить');
    } finally {
      setSavingId(null);
    }
  };

  const hasChanges = (item: DraftExample) =>
    item.draftSlug.trim() !== item.slug ||
    item.draftTitle.trim() !== (item.title || '') ||
    item.draftDescription.trim() !== (item.description || '') ||
    item.draftPrompt.trim() !== item.prompt ||
    item.draftImageUrl.trim() !== item.image_url ||
    item.draftSeoTitle.trim() !== (item.seo_title || '') ||
    item.draftSeoDescription.trim() !== (item.seo_description || '') ||
    (itemSelectedVariantIndex[item.id] ?? item.seo_variant_index ?? 0) !== (item.seo_variant_index ?? 0) ||
    item.draftTags.join(',') !== item.tags.join(',') ||
    item.draftPublished !== item.is_published;

  const parseTags = (value: string) =>
    value
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.length > 0);

  const normalizeTagList = (tags: string[]) => {
    const unique = new Set<string>();
    tags.forEach((tag) => {
      const cleaned = tag.trim().toLowerCase();
      if (cleaned) {
        unique.add(cleaned);
      }
    });
    return Array.from(unique);
  };

  const normalizeSelectedTags = (tags: string[]) => normalizeTagList(tags);

  const applyNewVariant = (
    variants: GenerationExampleSeoSuggestionVariant[],
    variantIndex: number
  ) => {
    const safeIndex = clampVariantIndex(variantIndex, variants.length);
    const selectedVariant = variants[safeIndex];
    if (!selectedVariant) {
      return;
    }
    setNewSeoVariants(variants);
    setNewSelectedVariantIndex(safeIndex);
    setNewSlug(selectedVariant.slug);
    setNewTitle(selectedVariant.title);
    setNewDescription(selectedVariant.description);
    setNewSeoTitle(selectedVariant.seo_title);
    setNewSeoDescription(selectedVariant.seo_description);
  };

  const applyItemVariant = (
    itemId: number,
    variants: GenerationExampleSeoSuggestionVariant[],
    variantIndex: number
  ) => {
    const safeIndex = clampVariantIndex(variantIndex, variants.length);
    const selectedVariant = variants[safeIndex];
    if (!selectedVariant) {
      return;
    }
    setItemSeoVariants((prev) => ({ ...prev, [itemId]: variants }));
    setItemSelectedVariantIndex((prev) => ({ ...prev, [itemId]: safeIndex }));
    setItems((prev) =>
      prev.map((row) =>
        row.id === itemId
          ? {
              ...row,
              draftSlug: selectedVariant.slug,
              draftTitle: selectedVariant.title,
              draftDescription: selectedVariant.description,
              draftSeoTitle: selectedVariant.seo_title,
              draftSeoDescription: selectedVariant.seo_description,
            }
          : row
      )
    );
  };

  const fillCreateSeoDraft = async () => {
    const prompt = newPrompt.trim();
    if (!prompt) {
      toast.error('Сначала укажите промпт примера');
      return;
    }
    const tags = normalizeTagList([...selectedExistingTags, ...parseTags(newTags)]);
    const fallbackVariants = buildLocalSeoVariants({
      title: newTitle,
      prompt,
      tags,
      description: newDescription,
      seoTitle: newSeoTitle,
      seoDescription: newSeoDescription,
      slug: newSlug,
    });

    setSeoGeneratingId('new');
    try {
      const draft = await getExampleSeoSuggestions({
        slug: newSlug.trim() || null,
        title: newTitle.trim() || null,
        description: newDescription.trim() || null,
        prompt,
        tags,
        seo_title: newSeoTitle.trim() || null,
        seo_description: newSeoDescription.trim() || null,
      });
      const responseVariants =
        draft.variants && draft.variants.length > 0
          ? draft.variants
          : [
              {
                slug: draft.slug,
                title: draft.title || newTitle.trim() || extractTitleFromPrompt(prompt),
                description: draft.description,
                seo_title: draft.seo_title,
                seo_description: draft.seo_description,
                faq: draft.faq || [],
              },
            ];
      const variants = normalizeSeoVariants(responseVariants, fallbackVariants);
      applyNewVariant(variants, draft.selected_index ?? 0);
      if (draft.source === 'openrouter') {
        toast.success(
          draft.model
            ? `SEO-поля сгенерированы (${draft.model})`
            : 'SEO-поля сгенерированы через OpenRouter'
        );
      } else {
        toast(draft.warning || 'OpenRouter недоступен, применен локальный SEO-шаблон', {
          icon: 'ℹ️',
        });
      }
    } catch {
      applyNewVariant(fallbackVariants, 0);
      toast('OpenRouter недоступен, применен локальный SEO-шаблон', { icon: 'ℹ️' });
    } finally {
      setSeoGeneratingId(null);
    }
  };

  const fillItemSeoDraft = async (item: DraftExample) => {
    const prompt = item.draftPrompt.trim();
    if (!prompt) {
      toast.error('Укажите промпт в карточке примера перед SEO-генерацией');
      return;
    }
    const fallbackVariants = buildLocalSeoVariants({
      title: item.draftTitle,
      prompt,
      tags: item.draftTags,
      description: item.draftDescription,
      seoTitle: item.draftSeoTitle,
      seoDescription: item.draftSeoDescription,
      slug: item.draftSlug,
    });
    setSeoGeneratingId(item.id);
    try {
      const draft = await getExampleSeoSuggestions({
        slug: item.draftSlug.trim() || null,
        title: item.draftTitle.trim() || null,
        description: item.draftDescription.trim() || null,
        prompt,
        tags: item.draftTags,
        seo_title: item.draftSeoTitle.trim() || null,
        seo_description: item.draftSeoDescription.trim() || null,
      });
      const responseVariants =
        draft.variants && draft.variants.length > 0
          ? draft.variants
          : [
              {
                slug: draft.slug,
                title: draft.title || item.draftTitle || extractTitleFromPrompt(prompt),
                description: draft.description,
                seo_title: draft.seo_title,
                seo_description: draft.seo_description,
                faq: draft.faq || [],
              },
            ];
      const variants = normalizeSeoVariants(responseVariants, fallbackVariants);
      applyItemVariant(item.id, variants, draft.selected_index ?? 0);
      if (draft.source === 'openrouter') {
        toast.success(
          draft.model
            ? `SEO-поля сгенерированы (${draft.model})`
            : 'SEO-поля сгенерированы через OpenRouter'
        );
      } else {
        toast(draft.warning || 'OpenRouter недоступен, применен локальный SEO-шаблон', {
          icon: 'ℹ️',
        });
      }
    } catch {
      applyItemVariant(item.id, fallbackVariants, 0);
      toast('OpenRouter недоступен, применен локальный SEO-шаблон', { icon: 'ℹ️' });
    } finally {
      setSeoGeneratingId(null);
    }
  };

  const handleCopyExampleLink = async (item: DraftExample) => {
    if (!item.id) {
      toast.error('Сначала сохраните карточку');
      return;
    }
    try {
      await copyTextToClipboard(getPublicExampleShortUrl(item.id));
      toast.success('Короткая ссылка скопирована');
    } catch {
      toast.error('Не удалось скопировать ссылку');
    }
  };

  const topExamples = useMemo(
    () =>
      [...items]
        .sort((a, b) => b.uses_count - a.uses_count)
        .slice(0, 6),
    [items]
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Примеры генераций</h2>
        <p className="text-sm text-gray-600">
          Загружайте изображения и промпты. Пользователи могут запускать генерацию по этим шаблонам.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Добавить пример</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-gray-600">Название (опционально)</label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Например: Городской стиль"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Slug (опционально)</label>
            <input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="gorodskoy-stil"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 mt-6 md:mt-7">
            <input
              type="checkbox"
              checked={newPublished}
              onChange={(e) => setNewPublished(e.target.checked)}
            />
            Публиковать сразу
          </label>
        </div>
        <div className="space-y-3">
          <TagMultiSelect
            label="Метки (выбор из списка)"
            options={existingTags}
            selected={selectedExistingTags}
            onChange={(next) => setSelectedExistingTags(normalizeSelectedTags(next))}
          />
          {existingTags.length === 0 && (
            <p className="text-xs text-gray-400">Пока нет сохраненных меток</p>
          )}
          <div>
            <label className="text-xs font-semibold text-gray-600">Новые метки (через запятую)</label>
            <input
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="уличный стиль, вечерний стиль, повседневный"
            />
            {parseTags(newTags).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {parseTags(newTags).map((tag) => (
                  <span key={`new-${tag}`} className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-700">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600">Промпт</label>
          <textarea
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            rows={4}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600">Описание карточки</label>
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Кратко объясните, что делает этот пример и какой результат ожидать."
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-gray-600">SEO Title</label>
            <input
              value={newSeoTitle}
              onChange={(e) => setNewSeoTitle(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Title для поисковой выдачи"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">SEO Description</label>
            <input
              value={newSeoDescription}
              onChange={(e) => setNewSeoDescription(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Description для поисковой выдачи"
            />
          </div>
        </div>
        {newSeoVariants.length > 0 && (
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
            <p className="text-xs font-semibold text-indigo-700">Варианты SEO</p>
            <div className="flex flex-wrap gap-2">
              {newSeoVariants.map((variant, index) => (
                <button
                  key={`new-seo-variant-${variant.slug}-${index}`}
                  type="button"
                  onClick={() => applyNewVariant(newSeoVariants, index)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    newSelectedVariantIndex === index
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                  }`}
                >
                  Вариант {index + 1}
                </button>
              ))}
            </div>
            <p className="text-xs text-indigo-900/80">
              Активный title: {newSeoVariants[newSelectedVariantIndex]?.title || '—'}
            </p>
            <p className="text-xs text-indigo-900/80">
              Активный SEO title: {newSeoVariants[newSelectedVariantIndex]?.seo_title || '—'}
            </p>
          </div>
        )}
        <FileUpload
          onFileSelect={(file) => handleUpload(file, 'new')}
          preview={newImageUrl ? resolveImageUrl(newImageUrl) : null}
          isLoading={uploadingId === 'new'}
          label="Изображение примера"
          hint="Загрузите сгенерированное изображение, до 10MB (конвертируется в WebP)"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={fillCreateSeoDraft}
            disabled={seoGeneratingId === 'new'}
            className="px-4 py-2 rounded-lg bg-indigo-50 text-indigo-700 font-semibold text-sm hover:bg-indigo-100"
          >
            {seoGeneratingId === 'new' ? 'Генерация SEO...' : 'Автозаполнить SEO'}
          </button>
          <button
            onClick={handleCreate}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700"
          >
            Добавить
          </button>
        </div>
      </div>

      {topExamples.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Самые популярные примеры
          </h3>
          <div className="space-y-2 text-sm text-gray-700">
            {topExamples.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <span className="truncate">{item.title || item.prompt.slice(0, 60)}</span>
                <span className="text-xs font-semibold text-gray-500">
                  {item.uses_count} запусков
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">A/B отчет SEO-вариантов</h3>
            <p className="text-sm text-gray-600">
              Фильтры по источнику и периоду, метрики просмотров карточки и переходов в генерацию.
            </p>
          </div>
          <button
            onClick={loadVariantReport}
            disabled={reportLoading}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 disabled:opacity-60"
          >
            {reportLoading ? 'Загрузка...' : 'Обновить отчет'}
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="text-xs font-semibold text-gray-600">Источник</label>
            <select
              value={reportSource}
              onChange={(e) => setReportSource(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="all">Все источники</option>
              <option value="seo_detail">SEO детальная</option>
              <option value="app_home">Приложение: главная</option>
              <option value="app_examples">Приложение: каталог</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Дата с</label>
            <input
              type="date"
              value={reportDateFrom}
              onChange={(e) => setReportDateFrom(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Дата по</label>
            <input
              type="date"
              value={reportDateTo}
              onChange={(e) => setReportDateTo(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="rounded-lg border bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">Сводка</p>
            <p className="text-sm font-semibold text-slate-800">
              Просмотры: {variantReport?.total_views ?? 0} · Переходы: {variantReport?.total_starts ?? 0}
            </p>
            <p className="text-xs text-slate-600">
              CR: {((variantReport?.average_conversion_rate ?? 0) * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        {!reportLoading && (!variantReport || variantReport.items.length === 0) && (
          <div className="text-sm text-slate-500 rounded-lg border border-dashed border-slate-200 p-4">
            Нет данных за выбранный период.
          </div>
        )}

        {variantReport && variantReport.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase border-b">
                  <th className="py-2 pr-3">Пример</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Вариант</th>
                  <th className="py-2 pr-3">Просмотры</th>
                  <th className="py-2 pr-3">Переходы</th>
                  <th className="py-2 pr-3">CR</th>
                </tr>
              </thead>
              <tbody>
                {variantReport.items.map((row) => (
                  <tr
                    key={`report-${row.example_id}-${row.source}-${row.seo_variant_index}`}
                    className="border-b last:border-0"
                  >
                    <td className="py-2 pr-3 text-gray-800">
                      <div className="font-medium">{row.title || 'Без названия'}</div>
                      <div className="text-xs text-gray-500">/{row.slug}</div>
                    </td>
                    <td className="py-2 pr-3 text-gray-700">{row.source}</td>
                    <td className="py-2 pr-3 text-gray-700">#{row.seo_variant_index + 1}</td>
                    <td className="py-2 pr-3 text-gray-700">{row.views_count}</td>
                    <td className="py-2 pr-3 text-gray-700">{row.starts_count}</td>
                    <td className="py-2 pr-3 text-gray-700">{(row.conversion_rate * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow p-6 animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-20 bg-gray-100 rounded" />
        </div>
      ) : (
        <div className="space-y-4">
          {items.length === 0 && (
            <div className="bg-white rounded-xl shadow p-6 text-sm text-gray-500">
              Пока нет примеров.
            </div>
          )}
          {items.map((item) => {
            const seoVariants = itemSeoVariants[item.id] || [];
            const selectedSeoVariant = itemSelectedVariantIndex[item.id] ?? item.seo_variant_index ?? 0;
            const currentVariantStats = (item.variant_stats || []).find(
              (stat) =>
                stat.source === 'seo_detail' &&
                stat.seo_variant_index === selectedSeoVariant
            );

            return (
              <div key={item.id} className="bg-white rounded-xl shadow p-6 space-y-4">
              <div className="flex flex-wrap gap-4">
                <div className="w-full md:w-48">
                  <img
                    src={resolveImageUrl(item.draftImageUrl)}
                    alt={item.title || 'Пример'}
                    className="rounded-lg border border-gray-100 object-cover w-full h-48"
                  />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Название</label>
                      <input
                        value={item.draftTitle}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((row) =>
                              row.id === item.id ? { ...row, draftTitle: e.target.value } : row
                            )
                          )
                        }
                        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Slug</label>
                      <input
                        value={item.draftSlug}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((row) =>
                              row.id === item.id ? { ...row, draftSlug: e.target.value } : row
                            )
                          )
                        }
                        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-700 mt-6 md:mt-7">
                      <input
                        type="checkbox"
                        checked={item.draftPublished}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((row) =>
                              row.id === item.id
                                ? { ...row, draftPublished: e.target.checked }
                                : row
                            )
                          )
                        }
                      />
                      Опубликовано
                    </label>
                  </div>
                  {!item.draftPublished && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Карточка не опубликована и не показывается в разделе «Примеры генераций».
                    </div>
                  )}
                  <div className="space-y-3">
                    <TagMultiSelect
                      label="Метки"
                      options={existingTags}
                      selected={item.draftTags}
                      onChange={(next) =>
                        setItems((prev) =>
                          prev.map((row) =>
                            row.id === item.id
                              ? { ...row, draftTags: normalizeSelectedTags(next) }
                              : row
                          )
                        )
                      }
                    />
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Метки (ручной ввод)</label>
                      <input
                        value={item.draftTags.join(', ')}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((row) =>
                              row.id === item.id
                                ? { ...row, draftTags: parseTags(e.target.value) }
                                : row
                            )
                          )
                        }
                        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                      />
                      {item.draftTags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.draftTags.map((tag) => (
                            <span
                              key={`${item.id}-${tag}`}
                              className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-700"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Промпт</label>
                    <textarea
                      value={item.draftPrompt}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((row) =>
                            row.id === item.id ? { ...row, draftPrompt: e.target.value } : row
                          )
                        )
                      }
                      rows={3}
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Описание карточки</label>
                    <textarea
                      value={item.draftDescription}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((row) =>
                            row.id === item.id ? { ...row, draftDescription: e.target.value } : row
                          )
                        )
                      }
                      rows={2}
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">SEO Title</label>
                      <input
                        value={item.draftSeoTitle}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((row) =>
                              row.id === item.id ? { ...row, draftSeoTitle: e.target.value } : row
                            )
                          )
                        }
                        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">SEO Description</label>
                      <input
                        value={item.draftSeoDescription}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((row) =>
                              row.id === item.id ? { ...row, draftSeoDescription: e.target.value } : row
                            )
                          )
                        }
                        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  {seoVariants.length > 0 && (
                    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
                      <p className="text-xs font-semibold text-indigo-700">Варианты SEO</p>
                      <div className="flex flex-wrap gap-2">
                        {seoVariants.map((variant, index) => (
                          <button
                            key={`item-${item.id}-seo-variant-${variant.slug}-${index}`}
                            type="button"
                            onClick={() => applyItemVariant(item.id, seoVariants, index)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                              selectedSeoVariant === index
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                            }`}
                          >
                            Вариант {index + 1}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-indigo-900/80">
                        Активный title: {seoVariants[selectedSeoVariant]?.title || '—'}
                      </p>
                      <p className="text-xs text-indigo-900/80">
                        Активный SEO title: {seoVariants[selectedSeoVariant]?.seo_title || '—'}
                      </p>
                    </div>
                  )}
                  <FileUpload
                    onFileSelect={(file) => handleUpload(file, item.id)}
                    preview={resolveImageUrl(item.draftImageUrl)}
                    isLoading={uploadingId === item.id}
                    label="Изображение"
                    hint="Нажмите для замены (конвертируется в WebP)"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => fillItemSeoDraft(item)}
                      disabled={savingId === item.id || seoGeneratingId === item.id}
                      className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                    >
                      {seoGeneratingId === item.id ? 'Генерация SEO...' : 'SEO автозаполнение'}
                    </button>
                    <button
                      onClick={() => handleSave(item)}
                      disabled={savingId === item.id || !hasChanges(item)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                        savingId === item.id || !hasChanges(item)
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {savingId === item.id ? 'Сохранение...' : 'Сохранить'}
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      disabled={savingId === item.id}
                      className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100"
                    >
                      Удалить
                    </button>
                    <button
                      onClick={() => handleCopyExampleLink(item)}
                      disabled={savingId === item.id}
                      className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    >
                      Скопировать короткую ссылку
                    </button>
                    <span className="text-xs text-gray-500">
                      Использований: {item.uses_count}
                    </span>
                    <span className="text-xs text-gray-500">
                      SEO вариант: #{selectedSeoVariant + 1}
                    </span>
                    {currentVariantStats && (
                      <span className="text-xs text-indigo-700">
                        SEO: просмотры {currentVariantStats.views_count}, переходы {currentVariantStats.starts_count}, CR {(currentVariantStats.conversion_rate * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Обновлено: {new Date(item.updated_at).toLocaleString()}
                  </p>
                </div>
              </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
