import astro from "eslint-plugin-astro";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["dist/", ".astro/", "node_modules/"],
  },
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  ...astro.configs["flat/recommended"],
];
