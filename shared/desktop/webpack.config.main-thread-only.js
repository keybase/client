/* eslint-disable flowtype/require-valid-file-annotation */
const webpack = require('webpack')
const baseConfig = require('./webpack.config.base')
const {noSourceMaps, isHot} = require('./webpack.common')

const makePlugins = () => {
  const defines = {
    __DEV__: true,
    __SCREENSHOT__: false,
    __VERSION__: JSON.stringify('Development'),
    'process.env.NODE_ENV': JSON.stringify('development'),
  }

  console.warn('Injecting dev defines: ', defines)
  const hotPlugin = isHot && [new webpack.HotModuleReplacementPlugin()]

  return [...baseConfig.plugins, new webpack.DefinePlugin(defines), ...(hotPlugin || [])].filter(Boolean)
}

const config = {
  ...baseConfig,
  bail: true,
  devtool: noSourceMaps ? undefined : 'inline-eval-cheap-source-map',
  entry: {
    main: ['./desktop/app/index.js'],
  },
  output: {
    ...baseConfig.output,
    publicPath: 'http://localhost:4000/dist/',
  },
  plugins: makePlugins(),
  target: 'electron-renderer',
}

module.exports = config
