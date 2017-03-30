/* eslint-disable flowtype/require-valid-file-annotation */
const webpack = require('webpack')
const path = require('path')
const getenv = require('getenv')

const defines = {
  '__HOT__': JSON.stringify(getenv.boolish('HOT', false)),
}

console.warn('Injecting defines: ', defines)

module.exports = {
  module: {
    loaders: [{
      test: /\.flow?$/,
      loader: 'null',
    }, {
      test: /\.native\.js?$/,
      loader: 'null',
    }, {
      test: /\.jsx?$/,
      loader: 'babel',
      exclude: /(node_modules|\/dist\/)/,
      query: Object.assign({
        cacheDirectory: false,
        babelrc: false,
        presets: [
          ['env', {
            useBuiltIns: false,
            targets: {
              electron: '1.4.12',
            },
            debug: true,
            exclude: ['transform-regenerator'],
          }],
          'babel-preset-react',
        ],
        plugins: [
          [
            'babel-plugin-transform-builtin-extend',
            {globals: ['Error']},
          ],
          'transform-flow-strip-types',
        ],
      }),
        // path.resolve('./electron-babelrc')}),
    }, {
      test: /\.json?$/,
      loader: 'json',
    }, {
      test: /emoji-datasource.*\.(gif|png)$/,
      loader: 'file?name=[name].[ext]',
    }, {
      test: /\.(gif|png|jpg)$/,
      include: path.resolve(__dirname, '../images/icons'),
      loader: 'null',
    }, {
      test: /\.ttf$/,
      loader: 'file?name=[name].[ext]',
    }, {
      test: /\.css$/,
      loader: 'style!css',
    }],
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].bundle.js',
    libraryTarget: 'commonjs2',
  },
  resolve: {
    extensions: ['', '.desktop.js', '.js', '.jsx', '.json', '.flow'],
  },
  plugins: [
    new webpack.DefinePlugin(defines),
  ],
  node: {
    __dirname: true,
  },
  entry: {
    index: ['./desktop/renderer/index.js'],
    main: ['./desktop/app/index.js'],
    launcher: ['./desktop/renderer/launcher.js'],
    'remote-component-loader': ['./desktop/renderer/remote-component-loader.js'],
  },
  profile: true,
}
