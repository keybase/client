const webpack = require('webpack')
const path = require('path')
// you can use this file to add your custom webpack plugins, loaders and anything you like.
// This is just the basic way to add additional webpack configurations.
// For more information refer the docs: https://storybook.js.org/configurations/custom-webpack-config

const fileLoaderRule = {
  loader: 'file-loader',
  options: {
    name: '[name].[ext]',
  },
}

const babelRule = {
  loader: 'babel-loader',
  options: {
    cacheDirectory: true,
    ignore: [/\.(native|ios|android)\.js$/],
    plugins: ['react-hot-loader/babel'],
    presets: [['@babel/preset-env', {debug: false, modules: false, targets: {electron: '4.0.1'}}]],
  },
}

module.exports = ({config, mode}) => {
  config.resolve = {
    extensions: ['.desktop.js', '.desktop.tsx', '.js', '.jsx', '.json', '.flow', '.ts', '.tsx'],
  }

  config.plugins = [
    ...config.plugins,
    new webpack.DefinePlugin({
      __DEV__: true,
      __STORYBOOK__: true,
      __STORYSHOT__: false,
      'process.platform': JSON.stringify('darwin'),
    }),
    new webpack.NormalModuleReplacementPlugin(
      /typed-connect/,
      __dirname + '/../util/__mocks__/typed-connect.tsx'
    ),
    new webpack.NormalModuleReplacementPlugin(/^electron$/, __dirname + '/../__mocks__/electron.tsx'),
    new webpack.NormalModuleReplacementPlugin(/dark-mode/, __dirname + '/../styles/__mocks__/dark-mode.tsx'),
    new webpack.NormalModuleReplacementPlugin(/engine/, __dirname + '/../__mocks__/engine.tsx'),
    new webpack.NormalModuleReplacementPlugin(/util\/saga/, __dirname + '/../__mocks__/saga.tsx'),
    new webpack.NormalModuleReplacementPlugin(/feature-flags/, __dirname + '/../__mocks__/feature-flags.tsx'),
  ]

  // Override default ignoring node_modules
  config.module.rules = [
    {
      // Don't include large mock images in a prod build
      include: path.resolve(__dirname, '../images/mock'),
      test: /\.jpg$/,
      use: ['null-loader'],
    },
    {
      include: path.resolve(__dirname, '../images/icons'),
      test: /\.(flow|native\.js|gif|png|jpg)$/,
      use: ['null-loader'],
    },
    {
      exclude: /((node_modules\/(?!universalify|fs-extra|react-redux|react-gateway))|\/dist\/)/,
      test: /\.jsx?$/,
      use: [babelRule],
    },
    {
      test: [/emoji-datasource.*\.(gif|png)$/, /\.ttf$/, /\.otf$/],
      use: [fileLoaderRule],
    },
    {
      include: path.resolve(__dirname, '../images/illustrations'),
      test: [/.*\.(gif|png)$/],
      use: [fileLoaderRule],
    },
    {
      include: path.resolve(__dirname, '../images/install'),
      test: [/.*\.(gif|png)$/],
      use: [fileLoaderRule],
    },
    {
      test: /\.css$/,
      use: ['style-loader', 'css-loader'],
    },
    {
      test: /\.(ts|tsx)$/,
      use: ['babel-loader'],
    },
  ]

  config.node = {
    __dirname: true,
    fs: 'empty',
  }

  return config
}
