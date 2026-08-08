import react from "@samjho/config/eslint/react";

export default [
  ...react,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
];
