// @flow

// Cache in the module. This can get called from multiple places and env vars can get lost
let isElectron = null
let isReactNative = null

module.exports = function(api /*: any */) {
  api.caller(c => {
    console.log('KB: Babel config detected caller: ', c.name)
    if (c.name === 'metro') {
      isReactNative = true
    } else {
      isElectron = true
    }
  })

  if (api.env() !== 'test') {
    api.cache(true)
  }

  if (!isElectron && !isReactNative) {
    throw new Error('MUST have env var BABEL_PLATFORM to all babel')
  }
  if (isElectron && isReactNative) {
    throw new Error('Packager is confused about babel platform')
  }

  if (isElectron) {
    console.error('KB babel.config.js for Electron')
    return {
      plugins: [
        '@babel/plugin-proposal-optional-catch-binding',
        '@babel/plugin-proposal-nullish-coalescing-operator',
        '@babel/plugin-proposal-optional-chaining',
        '@babel/plugin-proposal-object-rest-spread',
        '@babel/transform-flow-strip-types',
        '@babel/plugin-proposal-class-properties',
      ],
      presets: ['@babel/preset-env', '@babel/preset-react'],
    }
  } else if (isReactNative) {
    console.error('KB babel.config.js for ReactNative')
    return {
      presets: ['module:metro-react-native-babel-preset'],
    }
  }
}
