const transform = {
  "\\.[jt]sx?$": "babel-jest",
};

module.exports = {
  // Two environments: the library is isomorphic, and the `trace` path only exists in browsers, so
  // it needs a real `window` to be exercised.
  projects: [
    {
      displayName: "node",
      testEnvironment: "node",
      rootDir: __dirname,
      transform,
      testMatch: ["<rootDir>/__tests__/**/*.test.ts"],
      testPathIgnorePatterns: ["\\.dom\\.test\\.ts$"],
      setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
    },
    {
      displayName: "jsdom",
      testEnvironment: "jsdom",
      rootDir: __dirname,
      transform,
      testMatch: ["<rootDir>/__tests__/**/*.dom.test.ts"],
      setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
    },
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    "lib/**/*.ts",
    // Type-only module: compiles to zero executable statements.
    "!lib/types/**/*.ts",
  ],
  coverageDirectory: "coverage",
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};
