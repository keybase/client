/* global module, require */

// Packages that must not be bundled by webpack on desktop.
// Each entry maps to nullModulePath in webpack makeAlias.
//
// Node built-ins / legacy non-RN packages (webpack-only, not stubbed in Jest):
const webpackOnly = ['net', 'tls', 'msgpack', 'process', 'purepack', '@khanacademy/perseus-core']

// Native-only RN packages — also stubbed in Jest via jest.config.js + native-only-modules.js:
const nativeOnly = require('./native-only-modules')

module.exports = [...webpackOnly, ...nativeOnly]
