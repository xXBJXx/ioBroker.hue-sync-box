import config from '@iobroker/eslint-config';

export default [
    ...config,
    {
    ignores: [
            'admin/**',
            'build/**',
            'node_modules/**',
        'Hue HDMI Sync Box API - Philips Hue Developer Program_files/**',
    ],
    rules: {
        'jsdoc/no-blank-blocks': 'off',
        'jsdoc/require-jsdoc': 'off',
        'jsdoc/require-param': 'off',
    },
  },
];
