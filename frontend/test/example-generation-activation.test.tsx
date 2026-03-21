import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

jest.mock('../src/api/content', () => ({
  getGenerationExampleBySlug: jest.fn(),
  incrementExampleUse: jest.fn(),
}));

jest.mock('../src/api/activation', () => ({
  trackActivationEvent: jest.fn(),
}));

jest.mock('../src/components/auth/AuthGuard', () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../src/components/common/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../src/components/payment/InsufficientBalanceModal', () => ({
  InsufficientBalanceModal: () => null,
}));

jest.mock('../src/components/editing/ChatInput', () => ({
  ChatInput: ({ onSend }: { onSend: (message: string, attachments?: any[]) => void }) => (
    <button onClick={() => onSend('Prompt from test', [{ id: 'att-1' }])}>Send test prompt</button>
  ),
}));

jest.mock('../src/store/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('../src/store/exampleGenerationStore', () => ({
  useExampleGenerationStore: jest.fn(),
}));

const { ExampleGenerationPage } = require('../src/pages/ExampleGenerationPage') as typeof import('../src/pages/ExampleGenerationPage');
const { ExampleGenerationResult } = require('../src/components/examples/ExampleGenerationResult') as typeof import('../src/components/examples/ExampleGenerationResult');
const { getGenerationExampleBySlug, incrementExampleUse } = jest.requireMock('../src/api/content') as {
  getGenerationExampleBySlug: jest.Mock;
  incrementExampleUse: jest.Mock;
};
const { trackActivationEvent } = jest.requireMock('../src/api/activation') as {
  trackActivationEvent: jest.Mock;
};
const { useAuthStore } = jest.requireMock('../src/store/authStore') as {
  useAuthStore: jest.Mock;
};
const { useExampleGenerationStore } = jest.requireMock('../src/store/exampleGenerationStore') as {
  useExampleGenerationStore: jest.Mock;
};

describe('ExampleGenerationPage activation events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getGenerationExampleBySlug.mockResolvedValue({
      id: 11,
      slug: 'look-1',
      prompt: 'Prompt 1',
      image_url: '/uploads/look-1.webp',
      thumbnail_url: '/uploads/look-1.thumb.webp',
      seo_variant_index: 0,
      uses_count: 1,
      tags: [],
    });
    incrementExampleUse.mockResolvedValue({ success: true, uses_count: 2 });
    useAuthStore.mockReturnValue({
      user: {
        id: 7,
        role: 'USER',
        balance_credits: 6,
        subscription_type: null,
        subscription_expires_at: null,
        subscription_ops_remaining: 0,
      },
    });
    useExampleGenerationStore.mockReturnValue({
      isGenerating: false,
      result: null,
      startGeneration: jest.fn().mockResolvedValue({ status: 'completed', image_url: '/uploads/result.webp' }),
      reset: jest.fn(),
    });
  });

  test('tracks first_generate_click before generation starts', async () => {
    render(
      <MemoryRouter initialEntries={['/app/examples/generate?example=look-1&source=activation_onboarding&v=0']}>
        <Routes>
          <Route path="/app/examples/generate" element={<ExampleGenerationPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Send test prompt' }));

    await waitFor(() => {
      expect(trackActivationEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event_name: 'first_generate_click',
          route: '/app/examples/generate',
          entry_source: 'activation_onboarding',
        })
      );
    });
  });
});

describe('ExampleGenerationResult CTA', () => {
  beforeEach(() => {
    useExampleGenerationStore.mockReturnValue({
      result: {
        status: 'completed',
        image_url: '/uploads/result.webp',
        task_id: 'task-1',
        credits_spent: 2,
        has_watermark: false,
      },
    });
  });

  test('shows download and one-more-generation actions', () => {
    render(
      <MemoryRouter>
        <ExampleGenerationResult
          onBackToExamples={jest.fn()}
          onTryAgain={jest.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'Скачать' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сделать ещё одну генерацию' })).toBeInTheDocument();
  });
});
