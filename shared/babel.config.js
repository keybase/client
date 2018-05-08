// @flow
module.exports = function(api) {
  api.cache(true)
  // const env = api.env()
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
