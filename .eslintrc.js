module.exports = {
  env: { es6: true },
  parser: "babel-eslint",
  extends: ["standard", "standard-react"],
  overrides: [
    {
      files: ["*.tsx", "*.ts", "*.d.ts"],
      parser: "babel-eslint",
      rules: {
        "no-undef": "off", // ts itself will catch this
        "no-unused-vars": "off" // ts itself will catch this
      }
    }
  ],
  parserOptions: {
    ecmaVersion: 6,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
    babelOptions: {
      configFile: __dirname + "/shared/babel.config.js"
    }
  },
  globals: {
    requestAnimationFrame: "function",
    cancelAnimationFrame: "function",
    __DEV__: false,
    __STORYBOOK__: false,
    __STORYSHOT__: false
  },
  plugins: ["filenames", "babel", "import", "flowtype", "react-hooks"],
  settings: {
    "import/core-modules": ["electron", "react-native"],
    "import/resolver": {
      webpack: "webpack.config.base.js"
    }
  },
  rules: {
    "babel/func-params-comma-dangle": "off",
    "babel/no-unused-expressions": "off",
    camelcase: "off",
    "comma-dangle": ["error", "always-multiline"],
    curly: "off",
    "filenames/match-regex": [
      "error",
      "^[0-9a-z-.]+(\\.desktop|\\.native|\\.ios|\\.android)?$"
    ],
    "flowtype/define-flow-type": "error",
    "flowtype/delimiter-dangle": "off",
    "flowtype/generic-spacing": "off",
    "flowtype/no-dupe-keys": "off",
    "flowtype/object-type-delimiter": "off",
    "flowtype/require-valid-file-annotation": "off",
    "flowtype/semi": "off",
    "flowtype/space-after-type-colon": "off",
    "flowtype/space-before-generic-bracket": "off",
    "flowtype/union-intersection-spacing": "off",
    "flowtype/use-flow-type": "off",
    "flowtype/valid-syntax": "off",
    "generator-star-spacing": "off",
    "import/export": "error",
    "import/imports-first": "error",
    "import/named": "error",
    "import/no-duplicates": "error",
    "import/no-extraneous-dependencies": "error",
    "import/no-mutable-exports": "error",
    "import/no-named-as-default": "error",
    "import/no-named-as-default-member": "error",
    indent: "off",
    "jsx-quotes": "off",
    "no-duplicate-imports": "off",
    "no-mixed-operators": "off",
    "no-unused-expressions": "off",
    "react/jsx-boolean-value": ["error", "always"],
    "react/jsx-curly-spacing": "off",
    "react/jsx-equals-spacing": "error",
    "react/jsx-indent": "off",
    "react/jsx-indent-props": "off",
    "react/jsx-key": "error",
    "react/jsx-no-bind": ["error", { allowArrowFunctions: true }],
    "react/jsx-no-duplicate-props": "error",
    "react/jsx-no-undef": "error",
    "react/jsx-pascal-case": "error",
    "react/jsx-uses-react": "error",
    "react/jsx-uses-vars": "error",
    "react/jsx-space-before-closing": "off",
    "react/no-danger": "error",
    "react/no-did-mount-set-state": "error",
    "react/no-did-update-set-state": "off",
    "react/no-direct-mutation-state": "error",
    "react/no-is-mounted": "error",
    "react/no-unknown-property": "error",
    "react/no-unused-prop-types": "off",
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "error",
    "react/require-render-return": "error",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "sort-keys": ["error", "asc", { caseSensitive: true, natural: false }],
    "space-before-function-paren": "off",
    "standard/array-bracket-even-spacing": "off",
    "standard/computed-property-even-spacing": ["error", "never"],
    "standard/no-callback-literal": "off",
    "object-curly-spacing": "off",
    "object-curly-even-spacing": "off",
    strict: ["error", "global"],
    "yield-star-spacing": "off"
  }
};
