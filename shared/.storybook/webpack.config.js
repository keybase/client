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

module.exports = (storybookBaseConfig, configType) => {
  storybookBaseConfig.resolve = {
    extensions: ['.desktop.js', '.js', '.jsx', '.json', '.flow'],
  }
  storybookBaseConfig.plugins.push(
    new webpack.DefinePlugin({
      __DEV__: true,
      __STORYBOOK__: true,
      __SCREENSHOT__: true,
      'process.platform': JSON.stringify('darwin'),
    })
  )
  storybookBaseConfig.module.rules.push(
    {
      // Don't include large mock images in a prod build
      include: path.resolve(__dirname, '../images/mock'),
      test: /\.jpg$/,
      use: [fileLoaderRule],
    },
    {
      include: path.resolve(__dirname, '../images/icons'),
      test: /\.(flow|native\.js|gif|png|jpg)$/,
      use: ['null-loader'],
    },
    {
      test: [/emoji-datasource.*\.(gif|png)$/, /\.ttf$/],
      use: [fileLoaderRule],
    },
    {
      test: /\.css$/,
      use: ['style-loader', 'css-loader'],
    }
  )

  storybookBaseConfig.node = {
    __dirname: true,
  }

  return storybookBaseConfig
}
