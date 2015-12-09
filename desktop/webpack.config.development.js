const webpack = require('webpack')
const webpackTargetElectronRenderer = require('webpack-target-electron-renderer')
const baseConfig = require('./webpack.config.base')
const config = Object.assign({}, baseConfig)

const NO_SOURCE_MAPS = process.env.NO_SOURCE_MAPS === 'true'

config.debug = true
// TEMP config.devtool = NO_SOURCE_MAPS ? undefined : 'cheap-module-eval-source-map'
config.devtool = undefined
//config.entry = ['webpack-hot-middleware/client?path=http://localhost:4000/__webpack_hmr']
config.pathinfo = true
config.output.publicPath = 'http://localhost:4000/dist/'
config.bail = true // TEMP

config.plugins.push(
  new webpack.HotModuleReplacementPlugin(),
  // TEMP   new webpack.NoErrorsPlugin(),
  new webpack.DefinePlugin({
    '__DEV__': true
    })
)

config.target = webpackTargetElectronRenderer(config)
module.exports = config
