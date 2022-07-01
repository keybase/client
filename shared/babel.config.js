// Cache in the module. This can get called from multiple places and env vars can get lost
const skipAnimation = require('./common-adapters/skip-animations')
let isElectron = null
let isReactNative = null
let isTest = null

module.exports = function (api /*: any */) {
  const apiEnv = api.env()

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

  // console.error('KB babel.config.js ', {isElectron, isReactNative})

  if (!isElectron && !isReactNative) {
    throw new Error('MUST have env var BABEL_PLATFORM to all babel')
  }
  if (isElectron && isReactNative) {
    throw new Error('Packager is confused about babel platform')
  }

  if (isElectron) {
    // console.error('KB babel.config.js for Electron')
    return {
      plugins: [
        '@babel/plugin-proposal-optional-catch-binding',
        '@babel/plugin-proposal-nullish-coalescing-operator',
        '@babel/plugin-proposal-optional-chaining',
        '@babel/plugin-proposal-object-rest-spread',
        '@babel/plugin-proposal-class-properties',
        'react-native-web',
      ],
      presets: [
        isTest ? ['@babel/preset-env', {targets: {node: 'current'}}] : '@babel/preset-env',
        '@babel/preset-react',
        '@babel/preset-typescript',
      ],
    }
  } else if (isReactNative) {
    // console.error('KB babel.config.js for ReactNative')
    return {
      plugins: [...(skipAnimation ? [] : ['react-native-reanimated/plugin'])],
      presets: ['module:metro-react-native-babel-preset'],
    }
  }
}
