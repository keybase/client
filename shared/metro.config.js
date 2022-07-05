/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */
/* eslint-disable */

const {getDefaultConfig} = require('metro-config')
const {resolve} = require('metro-resolver')
const {replacements} = require('./mocks')

let storybook = 'none'
module.exports = (async () => {
  const {
    resolver: {sourceExts},
  } = await getDefaultConfig()

  // If we're in storybook mode, apply some mocks. The initial request from the RN app
  // tells us whether we are in storybook mode or normal mode.
  // The desktop equivalents of these mocks are in `shared/.storybook/webpack.config.js`.
  const mockingResolveRequest = (context, moduleName, platform) => {
    let newModuleName = moduleName
    if (moduleName === './storybook-index') {
      if (storybook === 'normal') {
        console.log('Switching to storybook mode, please restart metro.')
        process.exit(12)
      }
      storybook = 'storybook'
      newModuleName = './index'
    } else if (moduleName === './normal-index') {
      if (storybook === 'storybook') {
        console.log('Switching to normal mode, please restart metro')
        process.exit(12)
      }
      storybook = 'normal'
      newModuleName = './index'
    }
    if (storybook === 'storybook') {
      replacements.forEach(rep => {
        const [regex, replacement] = rep
        if (moduleName.match(regex)) {
          newModuleName = `./${replacement}.tsx`
        }
      })
    }
    // To prevent the metro resolver from just turning around and calling us
    context.resolveRequest = null

    return resolve(context, newModuleName, platform)
  }

  return {
    resolver: {
      resolveRequest: mockingResolveRequest,
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
