const webpack = require('webpack')
const webpackTargetElectronRenderer = require('webpack-target-electron-renderer')
const baseConfig = require('./webpack.config.base')
const config = Object.assign({}, baseConfig)
const getenv = require('getenv')

const NO_SOURCE_MAPS = getenv.bool('NO_SOURCE_MAPS', false)
const defines = {
  '__DEV__': true,
  'process.env.NODE_ENV': JSON.stringify('development')

}

console.log('Injecting dev defines: ', defines)

config.debug = true
config.devtool = NO_SOURCE_MAPS ? undefined : 'cheap-module-eval-source-map'
config.pathinfo = true
config.output.publicPath = 'http://localhost:4000/dist/'

// Uncomment below to figure out packaging bugs
// config.bail = true

config.plugins.push(new webpack.optimize.OccurenceOrderPlugin())

if (getenv.bool('HOT', false)) {
  config.plugins.push(new webpack.HotModuleReplacementPlugin())
}

config.plugins.push(
  new webpack.NoErrorsPlugin(),
  new webpack.DefinePlugin(defines)
)

if (getenv.bool('HOT', false)) {
  const HMR = 'webpack-hot-middleware/client?path=http://localhost:4000/__webpack_hmr'

  Object.keys(config.entry).forEach(k => {
    if (k !== 'main') { // node-only thread can't be hot loaded...
      config.entry[k] = [HMR].concat(config.entry[k]) // Note: all entry points need `if (module.hot) {module.hot.accept()}` to allow hot auto loads to work
    }
  })
}
config.target = webpackTargetElectronRenderer(config)
module.exports = config
