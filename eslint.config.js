import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    prettier,
    {
        plugins: {
            prettier: prettierPlugin
        },
        ignores: ['dist/**'],
        languageOptions: {
            ecmaVersion: 2018,
            sourceType: 'module',
            parser: tseslint.parser,
            parserOptions: {
                project: './tsconfig.json',
                tsconfigRootDir: __dirname
            }
        },
        rules: {
            semi: 'off',
            'dot-notation': 'off',
            eqeqeq: 'warn',
            curly: ['warn', 'all'],
            'prefer-arrow-callback': 'warn',
            'no-console': 'warn', // use the provided Homebridge log method instead
            'no-non-null-assertion': 'off',
            'lines-between-class-members': [
                'warn',
                'always',
                { exceptAfterSingleLine: true }
            ],
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_' }
            ],
            'prettier/prettier': 'error'
        }
    }
);
