const webpack = require('webpack')
const path = require('path')
const getenv = require('getenv')

const defines = {
  '__HOT__': JSON.stringify(getenv.boolish('HOT', false)),
}

console.log('Injecting defines: ', defines)

module.exports = {
  module: {
    loaders: [{
      test: /\.jsx?$/,
      loader: 'babel',
      exclude: /(node_modules|\/dist\/)/,
      query: {
        cacheDirectory: true,
        plugins: ['transform-runtime'],
        presets: ['es2015', 'stage-1', 'react'],
      },
    }, {
      test: /\.json?$/,
      loader: 'json',
    }],
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].bundle.js',
    libraryTarget: 'commonjs2',
  },
  resolve: {
    modulesDirectories: [path.join(__dirname, 'node_modules')],
    root: [path.join(__dirname)],
    extensions: ['', '.desktop.js', '.js', '.jsx', '.json'],
    packageMains: ['webpack', 'browser', 'web', 'browserify', ['jam', 'main'], 'main'],
  },
  resolveLoader: {
    modulesDirectories: ['web_loaders', 'web_modules', 'node_loaders', 'node_modules', path.join(__dirname, 'node_modules')],
    extensions: ['', '.webpack-loader.js', '.web-loader.js', '.loader.js', '.js'],
    packageMains: ['webpackLoader', 'webLoader', 'loader', 'main'],
  },
  plugins: [
    new webpack.DefinePlugin(defines),
  ],
  node: {
    __dirname: true,
  },
  entry: {
    index: ['./renderer/index.js'],
    main: ['./app/index.js'],
    launcher: ['./renderer/launcher.js'],
    'remote-component-loader': ['./renderer/remote-component-loader.js'],
  },
}
