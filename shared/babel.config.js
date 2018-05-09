// @flow
/*:: type Api = {
  cache: boolean => void,
  env: () => string,
}
*/
module.exports = function(api /*: Api */) {
  api.cache(true)
  var config = {
    plugins: [
      '@babel/plugin-proposal-object-rest-spread',
      '@babel/transform-flow-strip-types',
      '@babel/plugin-proposal-class-properties',
    ],
    presets: ['@babel/preset-env', '@babel/preset-react'],
  }

  return config
}
