// @flow
/*:: type Api = {
  cache: boolean => void,
  env: () => string,
}
*/

// Cache in the module. This can get called from multiple places and env vars can get lost
let isElectron = process.env.BABEL_PLATFORM === 'Electron'
let isReactNative = process.env.BABEL_PLATFORM === 'ReactNative'

module.exports = function(api /*: Api */) {
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
        '@babel/plugin-proposal-object-rest-spread',
        '@babel/transform-flow-strip-types',
        '@babel/plugin-proposal-class-properties',
      ],
      presets: ['@babel/preset-env', '@babel/preset-react'],
    }
  } else if (isReactNative) {
    console.error('KB babel.config.js for ReactNative')
    return {}
  }
}
