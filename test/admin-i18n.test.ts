import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const languages = ['de', 'en', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'uk', 'zh-cn'] as const;

function loadLanguage(language: (typeof languages)[number]): Record<string, string> {
    return JSON.parse(readFileSync(resolve('admin', 'i18n', `${language}.json`), 'utf8')) as Record<string, string>;
}

describe('Admin translations', () => {
    it('provides the same non-empty keys in every supported language', () => {
        const source = loadLanguage('en');
        const sourceKeys = Object.keys(source).sort();

        for (const language of languages) {
            const translated = loadLanguage(language);
            expect(Object.keys(translated).sort(), language).toEqual(sourceKeys);
            expect(
                Object.values(translated).every(value => value.trim().length > 0),
                language,
            ).toBe(true);
        }
    });
});
