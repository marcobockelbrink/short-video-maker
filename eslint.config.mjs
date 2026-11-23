import { config } from "@remotion/eslint-config-flat";

export default [
  ...config,
  {
    // CommonJS config files read by Tailwind and PostCSS (package.json has no
    // "type": "module", so .js files are CommonJS).
    files: ["postcss.config.js", "tailwind.config.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { module: "writable", require: "readonly" },
    },
  },
  {
    // The web UI under src/ui is a plain React app, not a Remotion
    // composition: its <video> plays the finished file in the browser and
    // has no Remotion timeline to synchronise with.
    files: ["src/ui/**/*.{ts,tsx}"],
    rules: {
      "@remotion/warn-native-media-tag": "off",
    },
  },
];
