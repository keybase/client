/* eslint-disable flowtype/require-valid-file-annotation */
const webpack = require('webpack')
const path = require('path')
const getenv = require('getenv')

const defines = {
  __HOT__: JSON.stringify(getenv.boolish('HOT', false)),
}

console.warn('Injecting defines: ', defines)

module.exports = {
  module: {
    rules: [
      {
        test: /\.flow?$/,
        use: ['null-loader'],
      },
      {
        test: /\.native\.js?$/,
        use: ['null-loader'],
      },
      {
        test: /\.jsx?$/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
              // Have to do this or it'll inherit babelrcs from the root and pull in things we don't want
              babelrc: false,
              presets: [
                [
                  'env',
                  {
                    useBuiltIns: false,
                    targets: {
                      electron: '1.6.10',
                    },
                    debug: true,
                    exclude: ['transform-regenerator'],
                  },
                ],
                'babel-preset-react',
              ],
              plugins: [
                ['babel-plugin-transform-builtin-extend', {globals: ['Error']}],
                'transform-flow-strip-types',
                'transform-object-rest-spread', // not supported by electron yet
                'babel-plugin-transform-class-properties', // not supported by electron yet
                'transform-es2015-destructuring', // due to a bug: https://github.com/babel/babel/pull/5469
              ],
            },
          },
        ],
        exclude: /((node_modules\/(?!universalify|fs-extra))|\/dist\/)/,
      },
      {
        test: /emoji-datasource.*\.(gif|png)$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
            },
          },
        ],
      },
      {
        test: /\.(gif|png|jpg)$/,
        include: path.resolve(__dirname, '../images/icons'),
        use: ['null-loader'],
      },
      {
        test: /\.ttf$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
            },
          },
        ],
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].bundle.js',
    libraryTarget: 'commonjs2',
  },
  resolve: {
    extensions: ['.desktop.js', '.js', '.jsx', '.json', '.flow'],
  },
  plugins: [new webpack.DefinePlugin(defines)],
  node: {
    __dirname: true,
  },
  entry: {
    index: ['./desktop/renderer/index.js'],
    main: ['./desktop/app/index.js'],
    launcher: ['./desktop/renderer/launcher.js'],
    'remote-component-loader': ['./desktop/renderer/remote-component-loader.js'],
  },
}
