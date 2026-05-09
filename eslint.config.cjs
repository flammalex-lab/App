// ESLint flat config (required by ESLint 9+; eslint-config-next 16+ ships
// the new format directly, no @eslint/eslintrc shim needed).
const nextCwv = require("eslint-config-next/core-web-vitals");
const reactHooks = require("eslint-plugin-react-hooks");

module.exports = [
  ...nextCwv,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "coverage/**",
    ],
  },
  {
    // The Next 16 / React 19 hook lint adds two stricter rules that surface
    // multiple legitimate-looking usages (BarcodeScanner ref bookkeeping,
    // BottomSheet drag state, etc.). Triaging them is real refactor work —
    // left as warn so CI stays green and we can address each site
    // individually instead of in a giant audit-fix PR.
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];
