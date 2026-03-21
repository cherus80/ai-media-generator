import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('../src/api/content', () => ({
  getGenerationExamples: jest.fn(),
}));

jest.mock('../src/api/activation', () => ({
  getActivationState: jest.fn(),
  trackActivationEvent: jest.fn(),
}));

jest.mock('../src/components/auth/AuthGuard', () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../src/components/common/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../src/hooks/useSeo', () => ({
  useSeo: jest.fn(),
}));

jest.mock('../src/store/authStore', () => ({
  useAuthStore: jest.fn(),
}));

const { HomePage } = require('../src/pages/HomePage') as typeof import('../src/pages/HomePage');
const { getGenerationExamples } = jest.requireMock('../src/api/content') as {
  getGenerationExamples: jest.Mock;
};
const { getActivationState, trackActivationEvent } = jest.requireMock('../src/api/activation') as {
  getActivationState: jest.Mock;
  trackActivationEvent: jest.Mock;
};
const { useAuthStore } = jest.requireMock('../src/store/authStore') as {
  useAuthStore: jest.Mock;
};

const makeCard = () => ({
  id: 1,
  slug: 'look-1',
  seo_variant_index: 0,
  title: 'Look 1',
  description: 'Desc 1',
  image_url: '/uploads/look-1.webp',
  thumbnail_url: '/uploads/look-1.thumb.webp',
  uses_count: 12,
  tags: ['fashion'],
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );

describe('HomePage activation onboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.mockReturnValue({
      user: {
        id: 7,
        subscription_type: null,
        subscription_expires_at: null,
        subscription_ops_remaining: 0,
      },
    });
    getGenerationExamples.mockResolvedValue({ items: [makeCard()], total: 1 });
  });

  test('shows onboarding-first entry for not activated users and tracks onboarding_start', async () => {
    getActivationState.mockResolvedValue({
      feature_enabled: true,
      completed_generations_count: 0,
      is_activated: false,
      first_generate_success_at: null,
    });

    renderPage();

    expect(await screen.findByText('Сгенерировать за 30 секунд')).toBeInTheDocument();
    await waitFor(() => {
      expect(trackActivationEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event_name: 'onboarding_start',
          route: '/app',
        })
      );
    });
  });

  test('falls back to existing hub for activated users', async () => {
    getActivationState.mockResolvedValue({
      feature_enabled: true,
      completed_generations_count: 2,
      is_activated: true,
      first_generate_success_at: '2026-03-21T10:05:00Z',
    });

    renderPage();

    expect(await screen.findByText('Быстрый старт')).toBeInTheDocument();
    expect(screen.queryByText('Сгенерировать за 30 секунд')).not.toBeInTheDocument();
  });
});
