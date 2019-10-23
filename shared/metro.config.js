/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */

// eslint-disable-next-line
const {getDefaultConfig} = require('metro-config')
const blacklist = require('metro-config/src/defaults/blacklist')
const modulePaths = require('./initialRNPackages')
const fs = require('fs')
const resolve = require('path').resolve

module.exports = (async () => {
  const {
    resolver: {sourceExts},
  } = await getDefaultConfig()
  return {
    resolver: {
      sourceExts: [...sourceExts, 'css'],
      blacklistRE: blacklist([/node_modules\/jest.*/, /node_modules\/whatwg-url.*/]),
    },
    transformer: {
      babelTransformerPath: require.resolve('./rn-css-transformer.js'),
      getTransformOptions: async () => {
        const moduleMap = {}
        modulePaths.forEach(path => {
          if (fs.existsSync(path)) {
            moduleMap[resolve(path)] = true
          }
        })
        return {
          preloadedModules: moduleMap,
          transform: {
            experimentalImportSupport: false,
            inlineRequires: {blacklist: moduleMap},
          },
        }
      },
    },
  }
})()
