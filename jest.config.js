/** @type {import("jest").Config} **/
module.exports = {
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    preset: 'ts-jest/presets/default-esm',
    transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.jest.json', useESM: true }],
    },
    testPathIgnorePatterns: ['/temp/'],
    transformIgnorePatterns: [
        '/node_modules/(?!blocklypy/)', // transform blocklypy
    ],
    moduleNameMapper: {
        '^blocklypy$': '<rootDir>/__mocks__/blocklypy.js',
        '^@abandonware/noble$': '<rootDir>/__mocks__/@abandonware/noble.js',
    },
};
