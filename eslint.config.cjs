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
    // React 19 hook rules. Both started as warnings while a backlog of
    // sites was migrated; flipped to "error" once BarcodeScanner,
    // BottomSheet, LineItem, OrderPlacedHero, QtyInput, and
    // QuickAddBuyerDialog were all refactored to use render-time state
    // sync / state-mirroring-refs instead of setState-in-effect /
    // refs-during-render.
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/refs": "error",
      "react-hooks/set-state-in-effect": "error",
    },
  },
];
