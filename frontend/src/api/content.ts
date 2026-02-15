/**
 * API клиент для публичных инструкций и примеров.
 */

import apiClient from './client';
import type {
  InstructionListResponse,
  InstructionType,
  GenerationExampleListResponse,
  GenerationExampleUseResponse,
  GenerationExampleUseRequest,
  ExampleTagListResponse,
  GenerationExampleItem,
} from '../types/content';

export const getInstructions = async (type?: InstructionType): Promise<InstructionListResponse> => {
  const response = await apiClient.get<InstructionListResponse>('/api/v1/content/instructions', {
    params: type ? { type } : {},
  });
  return response.data;
};

export const getGenerationExamples = async (params?: {
  tags?: string[];
  sort?: 'popular' | 'newest';
  limit?: number;
}): Promise<GenerationExampleListResponse> => {
  const queryParams: Record<string, string | number | undefined> = {};
  if (params?.tags && params.tags.length > 0) {
    queryParams.tags = params.tags.join(',');
  }
  if (params?.sort) {
    queryParams.sort = params.sort;
  }
  if (params?.limit) {
    queryParams.limit = params.limit;
  }
  const response = await apiClient.get<GenerationExampleListResponse>('/api/v1/content/examples', {
    params: queryParams,
  });
  return response.data;
};

export const incrementExampleUse = async (
  exampleId: number,
  payload?: GenerationExampleUseRequest
): Promise<GenerationExampleUseResponse> => {
  const response = await apiClient.post<GenerationExampleUseResponse>(
    `/api/v1/content/examples/${exampleId}/use`,
    payload || {}
  );
  return response.data;
};

export const getGenerationExampleBySlug = async (slug: string): Promise<GenerationExampleItem> => {
  const response = await apiClient.get<GenerationExampleItem>(`/api/v1/content/examples/by-slug/${encodeURIComponent(slug)}`);
  return response.data;
};

export const getExampleTags = async (): Promise<ExampleTagListResponse> => {
  const response = await apiClient.get<ExampleTagListResponse>('/api/v1/content/example-tags');
  return response.data;
};
