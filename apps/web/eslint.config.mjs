import reactHooks from 'eslint-plugin-react-hooks';
import root from '../../eslint.config.mjs';

export default [
  ...root,
  reactHooks.configs.flat.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML is forbidden (XSS). Render text instead.',
        },
      ],
      'no-restricted-imports': [
        'error',
        { name: 'react-router-dom', message: "Use 'react-router' (v7)." },
      ],
    },
  },
];
