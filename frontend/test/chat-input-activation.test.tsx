import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';

jest.mock('../src/api/editing', () => ({
  uploadAttachment: jest.fn(),
}));

jest.mock('../src/store/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('../src/utils/imageCompression', () => ({
  compressImageFile: jest.fn(),
}));

const { ChatInput } = require('../src/components/editing/ChatInput') as typeof import('../src/components/editing/ChatInput');
const { uploadAttachment } = jest.requireMock('../src/api/editing') as {
  uploadAttachment: jest.Mock;
};
const { useAuthStore } = jest.requireMock('../src/store/authStore') as {
  useAuthStore: jest.Mock;
};
const { compressImageFile } = jest.requireMock('../src/utils/imageCompression') as {
  compressImageFile: jest.Mock;
};

describe('ChatInput activation tracking hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.mockReturnValue({ user: null });
    compressImageFile.mockResolvedValue({
      file: new File(['binary'], 'photo.png', { type: 'image/png' }),
      meetsLimit: true,
    });
    uploadAttachment.mockResolvedValue({
      id: 'att-1',
      name: 'photo.png',
      url: '/uploads/photo.png',
      mime_type: 'image/png',
      size: 123,
    });
  });

  test('calls upload success hook when attachment is uploaded', async () => {
    const onAttachmentUploadSuccess = jest.fn();
    const { container } = render(
      <ChatInput
        onSend={jest.fn()}
        onAttachmentUploadSuccess={onAttachmentUploadSuccess}
      />
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();

    fireEvent.change(input, {
      target: {
        files: [new File(['raw'], 'photo.png', { type: 'image/png' })],
      },
    });

    await waitFor(() => {
      expect(onAttachmentUploadSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'att-1',
        })
      );
    });
  });
});
