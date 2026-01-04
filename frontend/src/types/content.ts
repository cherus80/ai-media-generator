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

export interface GenerationExampleItem {
  id: number;
  title?: string | null;
  prompt: string;
  image_url: string;
  uses_count: number;
  tags: string[];
}

export interface GenerationExampleListResponse {
  items: GenerationExampleItem[];
  total: number;
}

export interface GenerationExampleAdminItem extends GenerationExampleItem {
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
  title?: string | null;
  prompt: string;
  image_url: string;
  tags?: string[];
  is_published?: boolean;
}

export interface GenerationExampleUpdateRequest {
  title?: string | null;
  prompt?: string;
  image_url?: string;
  tags?: string[];
  is_published?: boolean;
}

export interface GenerationExampleUseResponse {
  success: boolean;
  uses_count: number;
}

export interface ExampleTagItem {
  tag: string;
  count: number;
}

export interface ExampleTagListResponse {
  items: ExampleTagItem[];
  total: number;
}
