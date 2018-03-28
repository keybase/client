/* eslint-disable flowtype/require-valid-file-annotation */
/* Our bundler for the desktop app.
 * We build:
 * Electron main thread / render threads for the main window and remote windows (menubar, trackers, etc)
 */
import DashboardPlugin from 'webpack-dashboard/plugin'
import UglifyJSPlugin from 'uglifyjs-webpack-plugin'
import getenv from 'getenv'
import merge from 'webpack-merge'
import path from 'path'
import webpack from 'webpack'

// External parameters which control the config
const isDev = process.env.NODE_ENV !== 'production'
const flags = {
  // webpack dev server has issues serving mixed hot/not hot so we have to build non-hot things separately
  isBeforeHot: getenv.boolish('BEFORE_HOT', false),
  isDev,
  isDumb: getenv.boolish('DUMB', false),
  isHot: getenv.boolish('HOT', false),
  isShowingDashboard: !getenv.boolish('NO_SERVER', !isDev),
}

console.log('Flags: ', flags)

// The common config all other derive from
const makeCommonConfig = () => {
  const makeRules = () => {
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

    return [
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
  }

  const makeCommonPlugins = () => {
    const defines = {
      __DEV__: flags.isDev,
      __HOT__: flags.isHot,
      __SCREENSHOT__: false,
      __STORYBOOK__: false,
      __VERSION__: flags.isDev ? JSON.stringify('Development') : JSON.stringify(process.env.APP_VERSION),
      'process.env.NODE_ENV': flags.isDev ? JSON.stringify('development') : JSON.stringify('production'),
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
    stats: {
      colors: true,
    },
  }

  return {
    bail: true,
    cache: flags.isDev,
    devServer,
    module: {
      rules: makeRules(),
    },
    node: {
      __dirname: true,
    },
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

const makeMainThreadConfig = () =>
  merge(commonConfig, {
    entry: {
      main: path.resolve(__dirname, 'app/index.js'),
    },
    name: 'mainThread',
    target: 'electron-main',
  })

const makeRenderThreadConfig = () => {
  const makeRenderPlugins = () => {
    // Visual dashboard to see what the hot server is doing
    const dashboardPlugin = flags.isShowingDashboard ? [new DashboardPlugin()] : []
    // Allow hot module reload when editing files
    const hmrPlugin =
      flags.isHot && flags.isDev
        ? [new webpack.HotModuleReplacementPlugin(), new webpack.NamedModulesPlugin()]
        : []
    // Don't spit out errors while building
    const noEmitOnErrorsPlugin = flags.isDev ? [new webpack.NoEmitOnErrorsPlugin()] : []

    return [...dashboardPlugin, ...hmrPlugin, ...noEmitOnErrorsPlugin].filter(Boolean)
  }

  // Have to inject some additional code if we're using HMR
  const HMREntries =
    flags.isHot && flags.isDev
      ? [
          'react-hot-loader/patch',
          'webpack-dev-server/client?http://localhost:4000',
          'webpack/hot/only-dev-server',
        ]
      : []

  return merge(commonConfig, {
    // Sourcemaps, eval is very fast, but you might want something else if you want to see the original code
    // Some eval sourcemaps cause issues with closures in chromium due to some bugs.
    devtool: flags.isDev ? 'eval' : 'source-map',
    entry: {
      index: [...HMREntries, path.resolve(__dirname, 'renderer/index.js')],
      'component-loader': [...HMREntries, path.resolve(__dirname, 'remote/component-loader.js')],
    },
    name: 'renderThread',
    plugins: makeRenderPlugins(),
    target: 'electron-renderer',
  })
}

const commonConfig = makeCommonConfig()
const mainThreadConfig = makeMainThreadConfig()
const renderThreadConfig = makeRenderThreadConfig()

// When we start the hot server we want to build the main/dll without hot reloading statically
const config = (flags.isBeforeHot ? [mainThreadConfig] : [mainThreadConfig, renderThreadConfig]).filter(
  Boolean
)

export default config
