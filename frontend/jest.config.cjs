module.exports = {
  rootDir: '.',
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    url: 'https://ai-generator.mix4.ru/',
  },
  setupFilesAfterEnv: ['<rootDir>/test/setupTests.ts'],
  transform: {
    '^.+\\.[tj]sx?$': '<rootDir>/test/esbuildTransform.cjs',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['<rootDir>/test/**/*.test.[tj]s?(x)'],
};
