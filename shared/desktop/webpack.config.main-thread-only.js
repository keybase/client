/* eslint-disable flowtype/require-valid-file-annotation */
const webpack = require('webpack')
const baseConfig = require('./webpack.config.base')
const getenv = require('getenv')

const NO_SOURCE_MAPS = getenv.boolish('NO_SOURCE_MAPS', true)
const HOT = getenv.boolish('HOT', false)

const defines = {
  __DEV__: true,
  __SCREENSHOT__: false,
  __VERSION__: JSON.stringify('Development'),
  'process.env.NODE_ENV': JSON.stringify('development'),
}

console.warn('Injecting dev defines: ', defines)

const hotPlugin = HOT ? [new webpack.HotModuleReplacementPlugin()] : []

const config = {
  ...baseConfig,
  bail: true,
  devtool: NO_SOURCE_MAPS ? undefined : 'inline-eval-cheap-source-map',
  entry: {
    main: ['./desktop/app/index.js'],
  },
  output: {
    ...baseConfig.output,
    publicPath: 'http://localhost:4000/dist/',
  },
  plugins: [...baseConfig.plugins, new webpack.DefinePlugin(defines), ...hotPlugin],
  target: 'electron-renderer',
}

module.exports = config
