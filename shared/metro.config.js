/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */
/* eslint-disable */

const {getDefaultConfig} = require('metro-config')
const {resolve} = require('metro-resolver')

let storybook = false
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
      storybook = true
      newModuleName = './index'
      console.log('Switching to storybook mode')
    } else if (moduleName === './normal-index') {
      storybook = false
      newModuleName = './index'
      console.log('Switching to normal mode')
    }
    if (storybook) {
      newModuleName = newModuleName
        // When you change these, also change in package.json and in .storybook/webpack.config.js
        .replace(/typed-connect/, '__mocks__/typed-connect')
        .replace(/navigation-hooks/, '__mocks__/navigation-hooks')
        .replace(/^electron$/, '/../__mocks__/electron')
        .replace(/engine$/, '/../__mocks__/engine')
        .replace(/dark-mode/, '../styles/__mocks__/dark-mode')
        .replace(/util\/saga/, '/../__mocks__/saga')
        .replace(/route-tree$/, '/../__mocks__/empty')
        .replace(/feature-flags/, '/../__mocks__/feature-flags')
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
      babelTransformerPath: require.resolve('./rn-css-transformer.js'),
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
