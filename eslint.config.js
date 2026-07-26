import globals from "globals";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      "src/admin/assets/*.min.js",
      "src/admin/assets/chart.umd.min.js",
    ],
  },
  {
    files: ["src/**/*.js", "vite.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        bootstrap: "readonly",
        Chart: "readonly",
        Papa: "readonly",
        XLSX: "readonly",
        jspdf: "readonly",
        Swiper: "readonly",
      },
    },
    rules: {
      "no-duplicate-imports": "error",
      "no-unreachable": "error",
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
    },
  },
];
