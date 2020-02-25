/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */

// eslint-disable-next-line
const {getDefaultConfig} = require('metro-config')
const {resolve} = require('metro-resolver')

let storybook = false
module.exports = (async () => {
  const {
    resolver: {sourceExts},
  } = await getDefaultConfig()

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
      // TODO: possibly need to bust some cache upon switching?
    }
    if (storybook) {
      newModuleName = newModuleName
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
