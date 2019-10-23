/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */

// eslint-disable-next-line
const {getDefaultConfig} = require('metro-config')
const blacklist = require('metro-config/src/defaults/blacklist')

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
      getTransformOptions: async () => ({
        transform: {
          experimentalImportSupport: false,
          inlineRequires: true,
        },
      }),
    },
  }
})()
