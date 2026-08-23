import config, { reactConfig } from '@iobroker/eslint-config';

export default [
    ...config,
    ...reactConfig,
    {
        ignores: ['dist/**'],
        rules: {
            'jsdoc/no-blank-blocks': 'off',
            'jsdoc/require-jsdoc': 'off',
            'jsdoc/require-param': 'off',
            'react/react-in-jsx-scope': 'off',
        },
    },
];
