//@ts-check

'use strict';

const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const glob = require('glob');

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

const isDevelopment = process.env.NODE_ENV === 'development';
console.log('isDevelopment:', isDevelopment);

/** @type WebpackConfig */
const extensionConfig = {
    target: 'node',
    mode: 'none',
    entry: {
        extension: './src/extension.ts',
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
        libraryTarget: 'commonjs2',
    },
    externals: [
        {
            vscode: 'commonjs vscode',
        },
        '@abandonware/bluetooth-hci-socket',
        'ws',
    ],
    resolve: {
        extensions: ['.ts', '.js', '.json'],
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: [/node_modules/, path.resolve(__dirname, 'src/views/webview')],
                use: [
                    {
                        loader: 'ts-loader',
                    },
                ],
            },
        ],
    },
    // devtool: 'nosources-source-map',
    devtool: isDevelopment ? 'source-map' : undefined,
    infrastructureLogging: {
        level: 'log',
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: path.resolve(
                        __dirname,
                        'node_modules/@pybricks/mpy-cross-v6/build/mpy-cross-v6.wasm',
                    ),
                    to: path.resolve(__dirname, 'dist'),
                },
                {
                    from: path.resolve(__dirname, 'src/assets'),
                    to: path.resolve(__dirname, 'dist/assets'),
                },
            ],
        }),
    ],
    optimization: {
        minimize: !isDevelopment,
        runtimeChunk: false,
        splitChunks: false,
    },
};

const webviewConfig = {
    target: 'web',
    mode: 'none',
    entry: Object.fromEntries(
        glob.sync(path.resolve(__dirname, 'src/views/webview/*.ts')).map((file) => {
            const name = path.basename(file, path.extname(file));
            return [name, file];
        }),
    ),
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
    },
    resolve: {
        extensions: ['.ts', '.js', '.json'],
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: [
                    {
                        loader: 'ts-loader',
                        options: {
                            configFile: path.resolve(__dirname, 'tsconfig.json'),
                        },
                    },
                ],
                exclude: /node_modules/,
            },
            { test: /\.css$/, use: ['style-loader', 'css-loader'] },
        ],
    },
    plugins: [
        new MonacoWebpackPlugin({
            languages: ['python', 'less'],
            globalAPI: true,
            filename: 'monaco.[name].worker.js',
        }),
    ],
    optimization: {
        minimize: true,
        runtimeChunk: false,
        splitChunks: false,
    },
    devtool: isDevelopment ? 'source-map' : undefined,
    infrastructureLogging: {
        level: 'log',
    },
    performance: isDevelopment
        ? {
              maxAssetSize: 512000, // Increase asset size limit to 500 KB
              maxEntrypointSize: 1024000, // Increase entry point size limit to 1 MB
              hints: false,
          }
        : undefined,
};

module.exports = [extensionConfig, webviewConfig];
