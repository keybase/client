/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 * @format
 */
/* eslint-disable */

const {getDefaultConfig} = require('metro-config')
const {resolve} = require('metro-resolver')

module.exports = (async () => {
  const {
    resolver: {sourceExts},
  } = await getDefaultConfig()

  return {
    resolver: {
      sourceExts: [...sourceExts, 'css'],
    },
    transformer: {
      babelTransformerPath: require.resolve('./rn-transformer.js'),
      getTransformOptions: async () => ({
        transform: {
          experimentalImportSupport: false,
          inlineRequires: true,
        },
      }),
      minifierConfig: {
        mangle: {
          keep_fnames: true,
        },
        compress: {
          keep_fnames: true,
          keep_classnames: true,
        },
      },
    },
  }
})()
