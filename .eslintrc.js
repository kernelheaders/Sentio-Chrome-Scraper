module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    webextensions: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  globals: {
    chrome: 'readonly',
    browser: 'readonly'
  },
  rules: {
    // Code quality rules
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
    
    // Security rules
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    
    // Best practices
    'eqeqeq': 'error',
    'no-alert': 'warn',
    'no-empty-function': 'warn',
    'no-magic-numbers': ['warn', { ignore: [0, 1, -1] }],
    'no-return-assign': 'error',
    'no-self-compare': 'error',
    'no-sequences': 'error',
    'no-throw-literal': 'error',
    'no-unmodified-loop-condition': 'error',
    'no-unused-expressions': 'error',
    'no-useless-call': 'error',
    'no-useless-concat': 'error',
    'no-useless-return': 'error',
    'prefer-promise-reject-errors': 'error',
    'radix': 'error',
    
    // Variables
    'no-delete-var': 'error',
    'no-label-var': 'error',
    'no-restricted-globals': ['error', 'event'],
    'no-shadow': 'warn',
    'no-shadow-restricted-names': 'error',
    'no-undef-init': 'error',
    'no-undefined': 'error',
    'no-use-before-define': 'error',
    
    // Stylistic
    'array-bracket-spacing': ['warn', 'never'],
    'block-spacing': 'warn',
    'brace-style': ['warn', '1tbs', { allowSingleLine: true }],
    'camelcase': 'warn',
    'comma-dangle': ['warn', 'never'],
    'comma-spacing': 'warn',
    'comma-style': 'warn',
    'computed-property-spacing': 'warn',
    'consistent-this': ['warn', 'self'],
    'eol-last': 'warn',
    'func-call-spacing': 'warn',
    'indent': ['warn', 2, { SwitchCase: 1 }],
    'key-spacing': 'warn',
    'keyword-spacing': 'warn',
    'line-comment-position': ['warn', { position: 'above' }],
    'lines-around-comment': ['warn', { beforeBlockComment: true }],
    'max-len': ['warn', { code: 100, ignoreUrls: true, ignoreStrings: true }],
    'new-cap': 'warn',
    'new-parens': 'warn',
    'no-array-constructor': 'warn',
    'no-lonely-if': 'warn',
    'no-mixed-spaces-and-tabs': 'warn',
    'no-multiple-empty-lines': ['warn', { max: 2 }],
    'no-new-object': 'warn',
    'no-spaced-func': 'warn',
    'no-trailing-spaces': 'warn',
    'no-unneeded-ternary': 'warn',
    'no-whitespace-before-property': 'warn',
    'object-curly-spacing': ['warn', 'always'],
    'one-var': ['warn', 'never'],
    'operator-assignment': 'warn',
    'operator-linebreak': ['warn', 'after'],
    'padded-blocks': ['warn', 'never'],
    'quote-props': ['warn', 'as-needed'],
    'quotes': ['warn', 'single', { avoidEscape: true }],
    'semi': ['warn', 'always'],
    'semi-spacing': 'warn',
    'space-before-blocks': 'warn',
    'space-before-function-paren': ['warn', { anonymous: 'never', named: 'never' }],
    'space-in-parens': 'warn',
    'space-infix-ops': 'warn',
    'space-unary-ops': 'warn',
    'spaced-comment': 'warn',
    
    // ES6+
    'arrow-parens': ['warn', 'as-needed'],
    'arrow-spacing': 'warn',
    'constructor-super': 'error',
    'generator-star-spacing': 'warn',
    'no-class-assign': 'error',
    'no-confusing-arrow': 'warn',
    'no-const-assign': 'error',
    'no-dupe-class-members': 'error',
    'no-duplicate-imports': 'warn',
    'no-new-symbol': 'error',
    'no-restricted-imports': 'warn',
    'no-this-before-super': 'error',
    'no-useless-computed-key': 'warn',
    'no-useless-constructor': 'warn',
    'no-useless-rename': 'warn',
    'no-var': 'warn',
    'object-shorthand': 'warn',
    'prefer-arrow-callback': 'warn',
    'prefer-const': 'warn',
    'prefer-rest-params': 'warn',
    'prefer-spread': 'warn',
    'prefer-template': 'warn',
    'rest-spread-spacing': 'warn',
    'symbol-description': 'warn',
    'template-curly-spacing': 'warn',
    'yield-star-spacing': 'warn'
  },
  overrides: [
    {
      files: ['**/*.test.js', '**/*.spec.js'],
      env: {
        jest: true
      },
      rules: {
        'no-magic-numbers': 'off'
      }
    },
    {
      files: ['src/content/**/*.js'],
      globals: {
        document: 'readonly',
        window: 'readonly'
      }
    },
    {
      files: ['src/background/**/*.js'],
      globals: {
        chrome: 'readonly',
        importScripts: 'readonly'
      }
    }
  ]
};