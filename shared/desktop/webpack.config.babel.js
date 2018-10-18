/* eslint-disable flowtype/require-valid-file-annotation */
/* Our bundler for the desktop app.
 * We build:
 * Electron main thread / render threads for the main window and remote windows (menubar, trackers, etc)
 */
import TerserPlugin from 'terser-webpack-plugin'
import merge from 'webpack-merge'
import path from 'path'
import webpack from 'webpack'

// When we start the hot server we want to build the main/dll without hot reloading statically
const config = (_, {mode}) => {
  const isDev = mode !== 'production'
  const isHot = isDev && !!process.env['HOT']
  const isStats = !!process.env['STATS']

  !isStats && console.log('Flags: ', {isDev, isHot})
  const makeCommonConfig = () => {
    const fileLoaderRule = {
      loader: 'file-loader',
      options: {name: '[name].[ext]'},
    }

    const babelRule = {
      loader: 'babel-loader',
      options: {
        cacheDirectory: true,
        ignore: [/\.(native|ios|android)\.js$/],
        plugins: [...(isHot ? ['react-hot-loader/babel'] : [])],
        presets: [['@babel/preset-env', {debug: false, modules: false, targets: {electron: '3.0.2'}}]],
      },
    }

    const rules = [
      {
        // Don't include large mock images in a prod build
        include: path.resolve(__dirname, '../images/mock'),
        test: /\.jpg$/,
        use: [isDev ? fileLoaderRule : 'null-loader'],
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
    ]

    // If we use the hot server it pulls in this config
    const devServer = {
      compress: false,
      contentBase: path.resolve(__dirname, 'dist'),
      hot: isHot,
      lazy: false,
      overlay: true,
      port: 4000,
      publicPath: 'http://localhost:4000/dist/',
      quiet: false,
      stats: {colors: true},
    }

    const defines = {
      __DEV__: isDev,
      __HOT__: isHot,
      __STORYBOOK__: false,
      __STORYSHOT__: false,
      __VERSION__: isDev ? JSON.stringify('Development') : JSON.stringify(process.env.APP_VERSION),
    }
    console.warn('Injecting defines: ', defines)

    return {
      bail: true,
      devServer,
      mode: isDev ? 'development' : 'production',
      module: {rules},
      node: {__dirname: true},
      output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'dist'),
        publicPath: isHot ? 'http://localhost:4000/dist/' : '../dist/',
      },
      plugins: [
        new webpack.DefinePlugin(defines), // Inject some defines
        new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/), // Skip a bunch of crap moment pulls in
      ],
      resolve: {
        extensions: ['.desktop.js', '.js', '.jsx', '.json', '.flow'],
      },
      stats: {
        ...(isDev
          ? {}
          : {
              exclude: undefined,
              maxModules: Infinity,
              providedExports: true,
              usedExports: true,
            }),
      },
      ...(isDev
        ? {}
        : {
            optimization: {
              minimizer: [
                new TerserPlugin({
                  cache: true,
                  parallel: true,
                  sourceMap: true,
                  terserOptions: {
                    compress: {
                      inline: false, // uglify has issues inlining code and handling variables https://github.com/mishoo/UglifyJS2/issues/2842
                    },
                    output: {
                      comments: false,
                    },
                    // warnings: 'verbose', // uncomment to see more of what uglify is doing
                  },
                }),
              ],
            },
          }),
    }
  }

  const commonConfig = makeCommonConfig()
  const mainThreadConfig = merge(commonConfig, {
    context: path.resolve(__dirname, '..'),
    entry: {main: './desktop/app/index.desktop.js'},
    name: 'mainThread',
    stats: {
      ...(isDev ? {} : {usedExports: false}), // ignore exports warnings as its mostly used in the render thread
    },
    target: 'electron-main',
  })
  const renderThreadConfig = merge(commonConfig, {
    context: path.resolve(__dirname, '..'),
    devtool: isDev ? 'eval' : 'source-map',
    entry: {
      'component-loader': './desktop/remote/component-loader.desktop.js',
      index: './desktop/renderer/index.desktop.js',
    },
    name: 'renderThread',
    plugins: [...(isHot && isDev ? [new webpack.HotModuleReplacementPlugin()] : [])],
    target: 'electron-renderer',
  })

  if (isHot) {
    return process.env['BEFORE_HOT'] ? mainThreadConfig : renderThreadConfig
  } else {
    return [mainThreadConfig, renderThreadConfig]
  }
}

export default config
