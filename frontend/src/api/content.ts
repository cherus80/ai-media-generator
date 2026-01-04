/**
 * API клиент для публичных инструкций и примеров.
 */

import apiClient from './client';
import type {
  InstructionListResponse,
  InstructionType,
  GenerationExampleListResponse,
  GenerationExampleUseResponse,
} from '../types/content';

export const getInstructions = async (type?: InstructionType): Promise<InstructionListResponse> => {
  const response = await apiClient.get<InstructionListResponse>('/api/v1/content/instructions', {
    params: type ? { type } : {},
  });
  return response.data;
};

export const getGenerationExamples = async (): Promise<GenerationExampleListResponse> => {
  const response = await apiClient.get<GenerationExampleListResponse>('/api/v1/content/examples');
  return response.data;
};

export const incrementExampleUse = async (exampleId: number): Promise<GenerationExampleUseResponse> => {
  const response = await apiClient.post<GenerationExampleUseResponse>(
    `/api/v1/content/examples/${exampleId}/use`
  );
  return response.data;
};
