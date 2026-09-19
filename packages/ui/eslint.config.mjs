import react from "@medhavi/config/eslint/react";

export default [
  ...react,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
];
