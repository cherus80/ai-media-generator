export type ActivationEventName =
  | 'register_success'
  | 'onboarding_start'
  | 'first_upload_success'
  | 'first_generate_click'
  | 'first_generate_success';

export interface ActivationEventPayload {
  event_name: ActivationEventName;
  anonymous_id?: string | null;
  session_id?: string | null;
  flow_id?: string | null;
  route?: string | null;
  entry_source?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  referral_code?: string | null;
  timestamp?: string | null;
}

export type ActivationEventContextPayload = Omit<ActivationEventPayload, 'event_name'> & {
  event_name?: ActivationEventName;
};

export interface ActivationState {
  feature_enabled: boolean;
  completed_generations_count: number;
  is_activated: boolean;
  first_generate_success_at?: string | null;
}

export interface ActivationMetrics {
  register_success_count: number;
  first_generate_success_count: number;
  activation_rate: number;
  time_to_first_generate: {
    p50_seconds?: number | null;
    p95_seconds?: number | null;
  };
}
