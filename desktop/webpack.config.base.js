const webpack = require('webpack')
const path = require('path')

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
    new webpack.DefinePlugin({
      'process.env': {
        'HOT': JSON.stringify(process.env.HOT),
        'NODE_ENV': JSON.stringify(process.env.NODE_ENV),
        'KEYBASE_RUN_MODE': JSON.stringify(process.env.KEYBASE_RUN_MODE),
        'XDG_RUNTIME_DIR': JSON.stringify(process.env.XDG_RUNTIME_DIR),
        'HOME': JSON.stringify(process.env.HOME)
      },
      'process.platform': JSON.stringify(process.platform) // TODO make sure this doesn't mess up cross platform builds
    })
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
