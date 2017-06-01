/* eslint-disable flowtype/require-valid-file-annotation */
const webpack = require('webpack')
const path = require('path')
const {babelRule, fileLoaderRule, isHot} = require('./webpack.common')

const makePlugins = () => {
  const defines = {
    __HOT__: JSON.stringify(isHot),
  }

  console.warn('Injecting defines: ', defines)
  return [new webpack.DefinePlugin(defines)]
}

const makeRules = () => {
  return [
    {
      include: path.resolve(__dirname, '../images/icons'),
      test: /\.(flow|native\.js|gif|png|jpg)$/,
      use: ['null-loader'],
    },
    {
      exclude: /((node_modules\/(?!universalify|fs-extra))|\/dist\/)/,
      test: /\.jsx?$/,
      use: [babelRule],
    },
    {
      test: /emoji-datasource.*\.(gif|png)$/,
      use: [fileLoaderRule],
    },
    {
      test: /\.ttf$/,
      use: [fileLoaderRule],
    },
    {
      test: /\.css$/,
      use: ['style-loader', 'css-loader'],
    },
  ]
}

const makeEntries = () => {
  return {
    index: ['./desktop/renderer/index.js'],
    launcher: ['./desktop/renderer/launcher.js'],
    main: ['./desktop/app/index.js'],
    'remote-component-loader': ['./desktop/renderer/remote-component-loader.js'],
  }
}

const config = {
  entry: makeEntries(),
  module: {
    rules: makeRules(),
  },
  node: {
    __dirname: true,
  },
  output: {
    filename: '[name].bundle.js',
    libraryTarget: 'commonjs2',
    path: path.join(__dirname, 'dist'),
  },
  plugins: makePlugins(),
  resolve: {
    extensions: ['.desktop.js', '.js', '.jsx', '.json', '.flow'],
  },
}

module.exports = config
