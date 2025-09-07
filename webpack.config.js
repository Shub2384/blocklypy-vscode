//@ts-check

'use strict';

const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

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
        minimize: true,
        runtimeChunk: false,
        splitChunks: false,
    },
};

const webviewConfig = {
    target: 'web',
    mode: 'none',
    entry: {
        BlocklypyWebview: path.resolve(
            __dirname,
            'src/views/webview',
            'BlocklypyWebview.ts',
        ),
        PythonPreviewWebview: path.resolve(
            __dirname,
            'src/views/webview',
            'PythonPreviewWebview.ts',
        ),
    },
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
                // loader: 'ts-loader',
                exclude: /node_modules/,
            },
            { test: /\.css$/, use: ['style-loader', 'css-loader'] },
        ],
    },
    plugins: [
        new MonacoWebpackPlugin({
            languages: ['python', 'less'],
            globalAPI: true,
            filename: 'monaco.[name].worker.js', // bundle workers with predictable names
        }),
    ],
    optimization: {
        minimize: true,
        runtimeChunk: false,
        splitChunks: false,
    },
    // devtool: 'nosources-source-map',
    infrastructureLogging: {
        level: 'log',
    },
};

module.exports = [extensionConfig, webviewConfig];
