// @flow
/*:: type Api = {
  cache: boolean => void,
  env: () => string,
}
*/

// Cache in the module. This can get called from multiple places and env vars can get lost
let isReactNative = process.env.BABEL_ENV === 'RN'
module.exports = function(api /*: Api */) {
  api.cache(true)

  console.error('babel.config.js config for ', isReactNative ? 'React Native' : 'Electron')

  if (isReactNative) {
    console.error('Babel for RN')
    return {}
  } else {
    console.error('Babel for Electron')
    return {
      plugins: [
        '@babel/plugin-proposal-object-rest-spread',
        '@babel/transform-flow-strip-types',
        '@babel/plugin-proposal-class-properties',
      ],
      presets: ['@babel/preset-env', '@babel/preset-react'],
    }
  }
}
