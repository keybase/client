const webpack = require('webpack');
const webpackTargetElectronRenderer = require('webpack-target-electron-renderer');
const baseConfig = require('./webpack.config.base');
const config = Object.assign({}, baseConfig);

config.devtool = 'source-map';
config.output.publicPath = '/dist/';

config.plugins.push(
  new webpack.optimize.OccurenceOrderPlugin(),
  new webpack.DefinePlugin({
    '__DEV__': false
  }),
  new webpack.optimize.UglifyJsPlugin({
    compressor: {
      screw_ie8: true,
      warnings: false
    }
  })
)

config.target = webpackTargetElectronRenderer(config);
module.exports = config;
