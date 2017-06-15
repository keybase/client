const webpack = require('webpack')
// you can use this file to add your custom webpack plugins, loaders and anything you like.
// This is just the basic way to add additional webpack configurations.
// For more information refer the docs: https://storybook.js.org/configurations/custom-webpack-config

module.exports = (storybookBaseConfig, configType) => {
  storybookBaseConfig.resolve = {
    extensions: ['.desktop.js', '.js', '.jsx', '.json', '.flow'],
  }
  storybookBaseConfig.plugins.push(
    new webpack.DefinePlugin({
      __STORYBOOK__: true,
    })
  )
  return storybookBaseConfig
}
