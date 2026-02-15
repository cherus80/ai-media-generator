export type InstructionType = 'video' | 'text';

export interface InstructionItem {
  id: number;
  type: InstructionType;
  title: string;
  description?: string | null;
  content: string;
  sort_order: number;
}

export interface InstructionListResponse {
  items: InstructionItem[];
  total: number;
}

export interface InstructionAdminItem extends InstructionItem {
  is_published: boolean;
  created_at: string;
  updated_at: string;
  created_by_user_id?: number | null;
  updated_by_user_id?: number | null;
}

export interface InstructionAdminListResponse {
  items: InstructionAdminItem[];
  total: number;
}

export interface InstructionCreateRequest {
  type: InstructionType;
  title: string;
  description?: string | null;
  content: string;
  sort_order?: number;
  is_published?: boolean;
}

export interface InstructionUpdateRequest {
  title?: string;
  description?: string | null;
  content?: string;
  sort_order?: number;
  is_published?: boolean;
}

export interface InstructionUploadResponse {
  file_id: string;
  file_url: string;
  file_size: number;
}

export interface GenerationExampleItem {
  id: number;
  slug: string;
  seo_variant_index: number;
  title?: string | null;
  description?: string | null;
  prompt: string;
  image_url: string;
  seo_title?: string | null;
  seo_description?: string | null;
  uses_count: number;
  tags: string[];
}

export interface GenerationExampleListResponse {
  items: GenerationExampleItem[];
  total: number;
}

export interface GenerationExampleAdminItem extends GenerationExampleItem {
  variant_stats?: GenerationExampleVariantStatItem[];
  is_published: boolean;
  created_at: string;
  updated_at: string;
  created_by_user_id?: number | null;
  updated_by_user_id?: number | null;
}

export interface GenerationExampleAdminListResponse {
  items: GenerationExampleAdminItem[];
  total: number;
}

export interface GenerationExampleCreateRequest {
  slug?: string | null;
  seo_variant_index?: number;
  title?: string | null;
  description?: string | null;
  prompt: string;
  image_url: string;
  seo_title?: string | null;
  seo_description?: string | null;
  tags?: string[];
  is_published?: boolean;
}

export interface GenerationExampleUpdateRequest {
  slug?: string | null;
  seo_variant_index?: number | null;
  title?: string | null;
  description?: string | null;
  prompt?: string;
  image_url?: string;
  seo_title?: string | null;
  seo_description?: string | null;
  tags?: string[];
  is_published?: boolean;
}

export interface GenerationExampleSeoFaqItem {
  question: string;
  answer: string;
}

export interface GenerationExampleSeoSuggestionRequest {
  slug?: string | null;
  title?: string | null;
  description?: string | null;
  prompt?: string | null;
  tags?: string[];
  seo_title?: string | null;
  seo_description?: string | null;
}

export interface GenerationExampleSeoSuggestionVariant {
  slug: string;
  title: string;
  description: string;
  seo_title: string;
  seo_description: string;
  faq: GenerationExampleSeoFaqItem[];
}

export interface GenerationExampleSeoSuggestionResponse {
  slug: string;
  title: string;
  description: string;
  seo_title: string;
  seo_description: string;
  faq: GenerationExampleSeoFaqItem[];
  selected_index: number;
  variants: GenerationExampleSeoSuggestionVariant[];
}

export interface GenerationExampleUseResponse {
  success: boolean;
  uses_count: number;
}

export interface GenerationExampleVariantStatItem {
  source: string;
  seo_variant_index: number;
  views_count: number;
  starts_count: number;
  conversion_rate: number;
}

export interface GenerationExampleUseRequest {
  seo_variant_index?: number;
  source?: string;
}

export interface ExampleTagItem {
  tag: string;
  count: number;
}

export interface ExampleTagListResponse {
  items: ExampleTagItem[];
  total: number;
}
