const webpack = require('webpack')
const path = require('path')

const defines = {
  '__HOT__': JSON.stringify(process.env.HOT === 'true'),
  '__DEV__': JSON.stringify(process.env.NODE_ENV !== 'production')
}

console.log('Injecting defines: ', defines)

module.exports = {
  module: {
    loaders: [{
      test: /\.jsx?$/,
      loader: 'babel',
      exclude: /(node_modules|\/dist\/)/,
      query: {
        optional: ['runtime'],
        stage: 2
      }
    }, {
      test: /\.json?$/,
      loader: 'json'
    }]
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].bundle.js',
    libraryTarget: 'commonjs2'
  },
  resolve: {
    extensions: ['', '.desktop.js', '.js', '.jsx', '.json'],
    packageMains: ['webpack', 'browser', 'web', 'browserify', ['jam', 'main'], 'main'],
    fallback: path.join(__dirname, 'node_modules')
  },
  resolveLoader: {
    modulesDirectories: [path.join(__dirname, 'node_modules')]
  },
  plugins: [
    new webpack.DefinePlugin(defines)
  ],
  externals: [
    'nslog'
  ],
  node: {
    __dirname: true
  },
  entry: {
    index: './renderer/index.js',
    main: './app/main.js',
    launcher: './renderer/launcher.js',
    'remote-component-loader': '../react-native/react/native/remote-component-loader.js'
  }
}
