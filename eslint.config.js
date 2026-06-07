import js from "@eslint/js";
import tseslint from "typescript-eslint";
import jsdoc from "eslint-plugin-jsdoc";
import tsdoc from "eslint-plugin-tsdoc";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**", "node_modules/**", "tests/**", "dashboard.html"]
  },
  {
    files: ["src/**/*.ts"],
    plugins: {
      jsdoc,
      tsdoc,
    },
    rules: {
      "tsdoc/syntax": "error",
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: true,
            FunctionExpression: true,
          },
          contexts: [
            "TSInterfaceDeclaration",
            "TSTypeAliasDeclaration",
            "TSPropertySignature",
            "TSMethodSignature"
          ]
        }
      ],
      "jsdoc/require-description": ["error", { contexts: ["any"] }],
      "jsdoc/require-param-description": "error",
      "jsdoc/require-returns-description": "error",
      "jsdoc/require-param": "off",
      "jsdoc/require-param-type": "off",
      "jsdoc/require-returns": "off",
      "jsdoc/require-returns-type": "off",
      // Disable other recommended rules that are not related to JSDoc/TSDoc for this brownfield project
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-useless-escape": "off",
      "preserve-caught-error": "off",
      "no-useless-assignment": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "no-useless-catch": "off",
    },
    settings: {
      jsdoc: {
        mode: "typescript"
      }
    }
  }
);
