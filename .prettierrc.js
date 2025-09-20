module.exports = {
    semi: true,
    trailingComma: 'all',
    singleQuote: true,
    printWidth: 88,
    tabWidth: 4,
    overrides: [
        {
            files: '*.md',
            options: {
                printWidth: 80,
                proseWrap: 'always',
                tabWidth: 2,
            },
        },
    ],
};
