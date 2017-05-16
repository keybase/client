/* eslint-disable flowtype/require-valid-file-annotation */
const webpack = require('webpack')
const webpackTargetElectronRenderer = require('webpack-target-electron-renderer')
const baseConfig = require('./webpack.config.base')

const config = Object.assign({}, baseConfig)
const getenv = require('getenv')

const NO_SOURCE_MAPS = getenv.boolish('NO_SOURCE_MAPS', true)
const defines = {
  __DEV__: true,
  __SCREENSHOT__: false,
  'process.env.NODE_ENV': JSON.stringify('development'),
  __VERSION__: JSON.stringify('Development'),
}

console.warn('Injecting dev defines: ', defines)

// Error out on errors
config.bail = true
config.debug = true
config.devtool = NO_SOURCE_MAPS ? undefined : 'inline-eval-cheap-source-map'
config.pathinfo = true
config.output.publicPath = 'http://localhost:4000/dist/'

config.entry = {
  main: ['./desktop/app/index.js'],
}

config.plugins.push(new webpack.DefinePlugin(defines))

if (getenv.boolish('HOT', false)) {
  config.plugins.push(new webpack.HotModuleReplacementPlugin())
}

config.target = webpackTargetElectronRenderer(config)
module.exports = config
