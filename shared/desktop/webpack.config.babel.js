/* eslint-disable flowtype/require-valid-file-annotation */
/* Our bundler for the desktop app.
 * We build:
 * Electron main thread / render threads for the main window and remote windows (menubar, trackers, etc)
 */
import UglifyJSPlugin from 'uglifyjs-webpack-plugin'
import getenv from 'getenv'
import merge from 'webpack-merge'
import path from 'path'
import webpack from 'webpack'

// When we start the hot server we want to build the main/dll without hot reloading statically
const config = (env, argv) => {
  const isDev = !argv.mode !== 'production'
  const flags = {
    isDev,
    isHot: getenv.boolish('HOT', false),
  }

  console.log('Flags: ', flags)
  const makeCommonConfig = () => {
    const fileLoaderRule = {
      loader: 'file-loader',
      options: {
        name: '[name].[ext]',
      },
    }

    const babelRule = {
      loader: 'babel-loader',
      options: {
        // Have to do this or it'll inherit babelrcs from the root and pull in things we don't want
        babelrc: false,
        cacheDirectory: true,
        plugins: [
          'react-hot-loader/babel',
          ['transform-builtin-extend', {globals: ['Error']}], // we override Error sometimes
          'transform-flow-strip-types', // ignore flow
          'transform-object-rest-spread', // not supported by electrons node yet
          'babel-plugin-transform-class-properties', // not supported by electrons node yet
        ],
        presets: [
          [
            'env',
            {
              debug: false,
              targets: {
                electron: '1.7.5',
              },
            },
          ],
          'babel-preset-react',
        ],
      },
    }

    const rules = [
      {
        // Don't include large mock images in a prod build
        include: path.resolve(__dirname, '../images/mock'),
        test: /\.jpg$/,
        use: [flags.isDev ? fileLoaderRule : 'null-loader'],
      },
      {
        include: path.resolve(__dirname, '../images/icons'),
        test: /\.(flow|native\.js|gif|png|jpg)$/,
        use: ['null-loader'],
      },
      {
        exclude: /((node_modules\/(?!universalify|fs-extra|react-redux))|\/dist\/)/,
        test: /\.jsx?$/,
        use: [babelRule],
      },
      {
        test: [/emoji-datasource.*\.(gif|png)$/, /\.ttf$/],
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
    ]

    const makeCommonPlugins = () => {
      const defines = {
        __DEV__: flags.isDev,
        __HOT__: flags.isHot,
        __SCREENSHOT__: false,
        __STORYBOOK__: false,
        __VERSION__: flags.isDev ? JSON.stringify('Development') : JSON.stringify(process.env.APP_VERSION),
      }
      console.warn('Injecting defines: ', defines)
      const definePlugin = [new webpack.DefinePlugin(defines)]
      const uglifyPlugin = flags.isDev
        ? []
        : [
            new UglifyJSPlugin({
              sourceMap: true,
              uglifyOptions: {
                output: {
                  comments: false,
                },
              },
            }),
          ]

      return [...definePlugin, ...uglifyPlugin].filter(Boolean)
    }

    // If we use the hot server it pulls in this config
    const devServer = {
      compress: false,
      contentBase: path.resolve(__dirname, 'dist'),
      hot: flags.isHot,
      lazy: false,
      overlay: true,
      port: 4000,
      publicPath: 'http://localhost:4000/dist/',
      quiet: false,
      stats: {colors: true},
    }

    return {
      bail: true,
      devServer,
      module: {rules},
      node: {__dirname: true},
      output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'dist'),
        publicPath: flags.isHot ? 'http://localhost:4000/dist/' : '../dist/',
      },
      plugins: makeCommonPlugins(),
      resolve: {
        extensions: ['.desktop.js', '.js', '.jsx', '.json', '.flow'],
      },
    }
  }

  const commonConfig = makeCommonConfig()
  const mainThreadConfig = merge(commonConfig, {
    context: path.resolve(__dirname, '..'),
    entry: {main: './desktop/app/index.js'},
    name: 'mainThread',
    target: 'electron-main',
  })
  const renderThreadConfig = merge(commonConfig, {
    context: path.resolve(__dirname, '..'),
    devtool: flags.isDev ? 'eval' : 'source-map',
    entry: {
      'component-loader': './desktop/remote/component-loader.js',
      index: './desktop/renderer/index.js',
    },
    name: 'renderThread',
    plugins: [...(flags.isHot && flags.isDev ? [new webpack.HotModuleReplacementPlugin()] : [])],
    target: 'electron-renderer',
  })

  if (flags.isHot) {
    return getenv.boolish('BEFORE_HOT', false) ? mainThreadConfig : renderThreadConfig
  } else {
    return [mainThreadConfig, renderThreadConfig]
  }
}

export default config
