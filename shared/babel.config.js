// Cache in the module. This can get called from multiple places and env vars can get lost
const skipAnimation = require('./common-adapters/skip-animations')
const enableWDYR = require('./util/why-did-you-render-enabled')

let isElectron = null
let isReactNative = null
let isTest = null

module.exports = function (api /*: any */) {
  const apiEnv = api.env()
  const isDev = apiEnv === 'development'

  if (apiEnv === 'test') {
    isTest = true
    isElectron = true
  } else if (apiEnv === 'test-rn') {
    isTest = true
    isReactNative = true
  } else {
    api.caller(c => {
      // console.error('KB: Babel config detected caller: ', c, c && c.name, api.env())
      if (!c || c.name === 'metro') {
        isReactNative = true
      } else {
        isElectron = true
      }
    })
  }

  api.cache(true)

  // console.error('KB babel.config.js ', {isElectron, isReactNative, apiEnv})

  if (!isElectron && !isReactNative) {
    throw new Error('MUST have env var BABEL_PLATFORM to all babel')
  }
  if (isElectron && isReactNative) {
    throw new Error('Packager is confused about babel platform')
  }

  // this is used just for our node side but not any bundling
  if (isElectron) {
    // console.error('KB babel.config.js for Electron')
    return {
      presets: [
        isTest ? ['@babel/preset-env', {targets: {node: 'current'}}] : '@babel/preset-env',
        '@babel/preset-typescript',
      ],
    }
  } else if (isReactNative) {
    // console.error('KB babel.config.js for ReactNative')
    return {
      plugins: [
        [
          'module-resolver',
          {
            alias: {
              '@': './',
              'react-native-kb': '../rnmodules/react-native-kb',
              'react-native-drop-view': '../rnmodules/react-native-drop-view',
            },
          },
        ],
        ...(skipAnimation ? [] : ['react-native-reanimated/plugin']),
        '@babel/plugin-proposal-numeric-separator',
        '@babel/plugin-transform-export-namespace-from',
        isDev
          ? [
              '@babel/plugin-transform-react-jsx-development',
              {
                runtime: 'automatic',
                ...(enableWDYR ? {importSource: '@welldone-software/why-did-you-render'} : {}),
              },
            ]
          : ['@babel/plugin-transform-react-jsx', {runtime: 'automatic'}],
      ],
      presets: [
        // lets us set our own jsx above
        ['module:metro-react-native-babel-preset', {useTransformReactJSXExperimental: true}],
      ],
      sourceMaps: true,
    }
  }
}
