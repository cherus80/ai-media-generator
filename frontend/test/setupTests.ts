import '@testing-library/jest-dom';

if (typeof URL !== 'undefined' && typeof URL.createObjectURL !== 'function') {
  // jsdom не предоставляет object URLs из коробки
  Object.defineProperty(URL, 'createObjectURL', {
    value: jest.fn(() => 'blob:test-preview'),
    writable: true,
  });
}

if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL !== 'function') {
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: jest.fn(),
    writable: true,
  });
}
