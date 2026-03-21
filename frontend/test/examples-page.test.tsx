import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('../src/api/content', () => ({
  getGenerationExamples: jest.fn(),
  getExampleTags: jest.fn(),
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

const { ExamplesPage } = require('../src/pages/ExamplesPage') as typeof import('../src/pages/ExamplesPage');
const { getGenerationExamples, getExampleTags } = jest.requireMock('../src/api/content') as {
  getGenerationExamples: jest.Mock;
  getExampleTags: jest.Mock;
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <ExamplesPage />
    </MemoryRouter>
  );

const makeCard = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  slug: 'look-1',
  seo_variant_index: 0,
  title: 'Look 1',
  description: 'Desc 1',
  image_url: '/uploads/look-1.webp',
  thumbnail_url: '/uploads/look-1.thumb.webp',
  uses_count: 12,
  tags: ['fashion'],
  ...overrides,
});

describe('ExamplesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getExampleTags.mockImplementation(() => new Promise(() => {}));
  });

  test('shows skeleton while catalog is loading', () => {
    getGenerationExamples.mockImplementation(() => new Promise(() => {}));

    renderPage();

    expect(screen.getByTestId('examples-skeleton')).toBeInTheDocument();
  });

  test('shows retry fallback when main catalog request fails', async () => {
    let catalogAttempts = 0;
    getGenerationExamples.mockImplementation(async (params?: { pageSize?: number }) => {
      if (params?.pageSize === 6) {
        return { items: [], total: 0 };
      }
      catalogAttempts += 1;
      if (catalogAttempts === 1) {
        throw new Error('boom');
      }
      return { items: [makeCard()], total: 1 };
    });

    renderPage();

    expect(await screen.findByText('Не удалось загрузить каталог примеров.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    await waitFor(() => {
      expect(screen.getByText('Look 1')).toBeInTheDocument();
    });
  });

  test('prefers thumbnail_url for card images', async () => {
    getGenerationExamples.mockImplementation(async (params?: { pageSize?: number }) => {
      if (params?.pageSize === 6) {
        return { items: [], total: 0 };
      }
      return { items: [makeCard()], total: 1 };
    });

    renderPage();

    const image = await screen.findByAltText('Look 1');
    expect(image).toHaveAttribute('src', expect.stringContaining('/uploads/look-1.thumb.webp'));
  });
});
