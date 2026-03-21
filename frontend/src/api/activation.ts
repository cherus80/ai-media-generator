import apiClient from './client';
import type { ActivationEventPayload, ActivationMetrics, ActivationState } from '../types/activation';

export async function getActivationState(): Promise<ActivationState> {
  const response = await apiClient.get<ActivationState>('/api/v1/activation/state');
  return response.data;
}

export async function trackActivationEvent(payload: ActivationEventPayload): Promise<void> {
  await apiClient.post('/api/v1/activation/events', payload);
}

export async function getActivationMetrics(): Promise<ActivationMetrics> {
  const response = await apiClient.get<ActivationMetrics>('/api/v1/activation/metrics');
  return response.data;
}
