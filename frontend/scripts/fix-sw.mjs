/**
 * Post-build script to patch sw.js with the missing _async_to_generator Babel helper.
 * The @ducanh2912/next-pwa package bundles workbox code through Babel but
 * doesn't include the async-to-generator runtime helper.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const swPath = join(__dirname, '..', 'public', 'sw.js');

if (!existsSync(swPath)) {
  console.log('[fix-sw] No sw.js found — skipping');
  process.exit(0);
}

let code = readFileSync(swPath, 'utf-8');

// Check if the helper is already defined
if (code.includes('function _async_to_generator')) {
  console.log('[fix-sw] _async_to_generator already defined — skipping');
  process.exit(0);
}

// Check if it's referenced but missing
if (!code.includes('_async_to_generator')) {
  console.log('[fix-sw] No _async_to_generator references found — skipping');
  process.exit(0);
}

// Add the Babel helper at the top of the file
const helper = `
function _async_to_generator(fn) {
  return function () {
    var self = this, args = arguments;
    return new Promise(function (resolve, reject) {
      var gen = fn.apply(self, args);
      function step(key, arg) {
        try {
          var info = gen[key](arg);
          var value = info.value;
        } catch (error) {
          reject(error);
          return;
        }
        if (info.done) {
          resolve(value);
        } else {
          Promise.resolve(value).then(_next, _throw);
        }
      }
      function _next(value) {
        step("next", value);
      }
      function _throw(err) {
        step("throw", err);
      }
      _next();
    });
  };
}
`;

code = helper + '\n' + code;
writeFileSync(swPath, code, 'utf-8');
console.log('[fix-sw] Patched sw.js with _async_to_generator helper');
