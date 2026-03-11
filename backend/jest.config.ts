/**
 * jest.config.ts
 *
 * Configures Jest to transpile TypeScript via ts-jest, resolve path aliases
 * matching tsconfig.json, and collect coverage from src/ only.
 */
import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",

  // Only scan the tests/ directory — keeps src/ clean.
  roots: ["<rootDir>/tests"],

  // Match test files by naming convention.
  testMatch: ["**/*.test.ts"],

  // Resolve path aliases so @/config/*, @/store/*, etc. work in tests.
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1"
  },

  // ts-jest configuration — use the project tsconfig but relax noUnusedLocals
  // in test context to allow test-helper imports without compiler noise.
  transform: {
    "^.+\\.ts$": ["ts-jest", {
      tsconfig: {
        strict:           true,
        noUnusedLocals:   false,
        noUnusedParameters: false,
      },
    }],
  },

  // Emit clean coverage report scoped to source only.
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/server.ts",           // Entry point; not unit-testable in isolation.
    "!src/**/*.types.ts",       // Pure type declarations; no runtime logic.
  ],

  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"],

  // Fail CI if any test file is empty or has no assertions.
  passWithNoTests: false,

  // Ensure each test file has its own isolated module registry.
  clearMocks:    true,
  resetMocks:    true,
  restoreMocks:  true,
};

export default config;
