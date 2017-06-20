const webpack = require('webpack')
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
      __STORYBOOK__: true,
    })
  )
  storybookBaseConfig.module.rules.push(
    {
      test: [/emoji-datasource.*\.(gif|png)$/, /\.ttf$/],
      use: [fileLoaderRule],
    },
    {
      test: /\.css$/,
      use: ['style-loader', 'css-loader'],
    }
  )
  return storybookBaseConfig
}
