/** ts-jest was already a dependency but no config existed, so tests never ran. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  // The generated Prisma client is large and irrelevant to unit tests.
  modulePathIgnorePatterns: ['<rootDir>/src/generated'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { diagnostics: { warnOnly: true } }],
  },
};
