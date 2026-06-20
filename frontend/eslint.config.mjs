import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig([{
    extends: [...nextCoreWebVitals],
    rules: {
        // Keep lint useful for real defects while avoiding broad UI-text and
        // React Compiler transition rules from blocking production builds.
        'react/no-unescaped-entities': 'off',
        'react-hooks/set-state-in-effect': 'off',
        'react-hooks/static-components': 'off',
        'react-hooks/purity': 'off',
        'react-hooks/use-memo': 'off',
    },
}]);