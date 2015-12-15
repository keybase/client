const webpack = require('webpack')
const webpackTargetElectronRenderer = require('webpack-target-electron-renderer')
const baseConfig = require('./webpack.config.base')
const config = Object.assign({}, baseConfig)

const NO_SOURCE_MAPS = process.env.NO_SOURCE_MAPS === 'true'

config.debug = true
config.devtool = NO_SOURCE_MAPS ? undefined : 'cheap-module-eval-source-map'
config.pathinfo = true
config.output.publicPath = 'http://localhost:4000/dist/'

// Uncomment below to figure out packaging bugs
// config.bail = true

config.plugins.push(
  new webpack.optimize.OccurenceOrderPlugin(),
  new webpack.HotModuleReplacementPlugin(),
  new webpack.NoErrorsPlugin(),
  new webpack.DefinePlugin({
    '__DEV__': true
  })
)

if (process.env.HOT === 'true') {
  const HMR = 'webpack-hot-middleware/client?path=http://localhost:4000/__webpack_hmr'

  Object.keys(config.entry).forEach(k => {
    if (k !== 'main') { // node-only thread can't be hot loaded...
      config.entry[k] = [HMR].concat(config.entry[k]) // Note: all entry points need `if (module.hot) {module.hot.accept()}` to allow hot auto loads to work
    }
  })
}
config.target = webpackTargetElectronRenderer(config)
module.exports = config
