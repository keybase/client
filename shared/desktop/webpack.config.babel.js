/* Our bundler for the desktop app.
 * We build:
 * Electron main thread / render threads for the main window and remote windows (menubar, trackers, etc)
 */
import TerserPlugin from 'terser-webpack-plugin'
import merge from 'webpack-merge'
import path from 'path'
import webpack from 'webpack'
import HtmlWebpackPlugin from 'html-webpack-plugin'
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin')

// why did you render
const enableWDYR = false

// When we start the hot server we want to build the main/dll without hot reloading statically
const config = (_, {mode}) => {
  const isDev = mode !== 'production'
  const isHot = isDev && !!process.env['HOT']
  const isProfile = !isDev && !!process.env['PROFILE']
  if (isProfile) {
    for (let i = 0; i < 10; ++i) {
      console.log('Webpack profiling on')
    }
  }

  const fileSuffix = isDev ? '.dev' : isProfile ? '.profile' : ''

  console.error('Flags: ', {isDev, isHot, isProfile})

  const makeRules = nodeThread => {
    const babelRule = {
      loader: 'babel-loader',
      options: {
        cacheDirectory: true,
        ignore: [/\.(native|ios|android)\.(ts|js)x?$/],
        plugins: [...(isHot && !nodeThread ? ['react-refresh/babel'] : [])],
        presets: [
          ['@babel/preset-env', {debug: false, modules: false, targets: {electron: '19.0.4'}}],
          [
            '@babel/preset-react',
            {
              runtime: 'automatic',
              development: isDev,
              ...(isDev && enableWDYR ? {importSource: '@welldone-software/why-did-you-render'} : {}),
            },
          ],
          '@babel/preset-typescript',
        ],
      },
    }

    return [
      ...(isDev
        ? []
        : [
            {
              // Don't include why did you render
              include: /welldone/,
              test: /\.(ts|js)x?$/,
              use: ['null-loader'],
            },
          ]),
      {
        // Don't include large mock images in a prod build
        include: path.resolve(__dirname, '../images/mock'),
        test: /\.jpg$/,
        ...(isDev ? {type: 'asset/resource'} : {use: ['null-loader']}),
      },
      {
        include: path.resolve(
          __dirname,
          '../node_modules/@react-navigation/native-stack/node_modules/@react-navigation/elements/lib/module/assets'
        ),
        test: /\.(native\.js|gif|png|jpg)$/,
        use: ['null-loader'],
      },

      {
        include: path.resolve(__dirname, '../node_modules/@react-navigation/elements/lib/module/assets'),
        test: /\.(native\.js|gif|png|jpg)$/,
        use: ['null-loader'],
      },
      {
        include: path.resolve(__dirname, '../images/icons'),
        test: /\.(native\.js|gif|png|jpg)$/,
        use: ['null-loader'],
      },
      {
        exclude: /((node_modules\/(?!universalify|react-redux|react-gateway))|\/dist\/)/,
        test: /\.(ts|js)x?$/,
        use: [babelRule],
      },
      {
        test: [/emoji-datasource.*\.(gif|png)$/, /\.ttf$/],
        type: 'asset/resource',
      },
      {
        include: path.resolve(__dirname, '../images/illustrations'),
        test: [/.*\.(gif|png)$/],
        type: 'asset/resource',
      },
      {
        include: path.resolve(__dirname, '../images/install'),
        test: [/.*\.(gif|png)$/],
        type: 'asset/resource',
      },
      {
        include: path.resolve(__dirname, '../images/releases'),
        test: [/.*\.(png)$/],
        type: 'asset/resource',
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ]
  }

  const publicPath = isHot ? 'http://localhost:4000/dist/' : '../dist/'

  const makeCommonConfig = () => {
    // If we use the hot server it pulls in this config
    const defines = {
      __FILE_SUFFIX__: JSON.stringify(fileSuffix),
      __PROFILE__: isProfile,
      __DEV__: isDev,
      __HOT__: isHot,
      __STORYBOOK__: false,
      __STORYSHOT__: false,
      __VERSION__: isDev ? JSON.stringify('Development') : JSON.stringify(process.env.APP_VERSION),
    }
    console.warn('Injecting defines: ', defines)

    const alias = {
      'react-native$': 'react-native-web',
      'react-native-reanimated': false,
    }
    if (isDev) {
    } else {
      if (isProfile) {
        alias['react-dom$'] = 'react-dom/profiling'
      }
      alias['@welldone-software/why-did-you-render'] = false
    }

    return {
      bail: true,
      context: path.resolve(__dirname, '..'),
      devtool: isDev ? 'cheap-module-source-map' : 'source-map',
      mode: isDev ? 'development' : 'production',
      node: false,
      output: {
        filename: `[name]${fileSuffix}.bundle.js`,
        path: path.resolve(__dirname, 'dist'),
        // can be the same?
        publicPath,
      },
      plugins: [
        new webpack.DefinePlugin(defines), // Inject some defines
        new webpack.IgnorePlugin({resourceRegExp: /^\.\/locale$/, contextRegExp: /moment$/}), // Skip a bunch of crap moment pulls in
        ...(isDev ? [] : [new webpack.IgnorePlugin({resourceRegExp: /^lodash$/})]), // Disallow entire lodash
      ],
      resolve: {
        alias,
        extensions: ['.desktop.js', '.desktop.tsx', '.web.js', '.js', '.jsx', '.tsx', '.ts', '.json'],
      },
      ...(isDev
        ? {}
        : {
            optimization: {
              minimizer: [
                // options from create react app: https://github.com/facebook/create-react-app/blob/master/packages/react-scripts/config/webpack.config.prod.js
                new TerserPlugin({
                  parallel: true,
                  terserOptions: {
                    parse: {ecma: 8},
                    compress: {
                      comparisons: false,
                      ecma: 5,
                      inline: 2,
                      warnings: false,
                    },
                    keep_fnames: true,
                    keep_classnames: true,
                    mangle: false,
                    output: {comments: false},
                    // warnings: 'verbose', // uncomment to see more of what uglify is doing
                  },
                }),
              ],
            },
          }),
    }
  }

  const commonConfig = makeCommonConfig()
  const nodeConfig = merge(commonConfig, {
    entry: {node: './desktop/app/node.desktop.tsx'},
    module: {rules: makeRules(true)},
    name: 'node',
    plugins: [
      // blacklist common things from the main thread to ensure the view layer doesn't bleed into the node layer
      new webpack.IgnorePlugin({resourceRegExp: /^react$/}),
    ],
    stats: {
      ...(isDev ? {} : {usedExports: false}), // ignore exports warnings as its mostly used in the render thread
    },
    target: 'electron-main',
  })

  const makeHtmlName = name => `${name}${fileSuffix}.html`
  const makeViewPlugins = names =>
    [
      // needed to help webpack and electron renderer
      new webpack.DefinePlugin({
        global: 'globalThis',
        'process.env.NODE_DEBUG': JSON.stringify(process.env.NODE_DEBUG),
      }),
      ...(isHot ? [new ReactRefreshWebpackPlugin()] : []),
      // Map since we generate multiple html files
      ...names.map(
        name =>
          new HtmlWebpackPlugin({
            chunks: [name],
            filename: makeHtmlName(name),
            inject: false,
            isDev,
            name,
            templateContent: ({htmlWebpackPlugin}) => `
<!DOCTYPE html>
<html>
    <head>
        <title>${htmlWebpackPlugin.options.isDev ? 'Keybase DEV' : 'Keybase'}</title>
        <meta charset="utf-8" http-equiv="Content-Security-Policy" content="
    default-src 'none';
    object-src 'self' http://127.0.0.1:*;
    frame-src http://127.0.0.1:*;
    font-src 'self' ${htmlWebpackPlugin.options.isDev ? 'http://localhost:4000' : ''};
    media-src 'self' http://127.0.0.1:*;
    img-src 'self' data: http://127.0.0.1:* https://keybase.io/ https://pbs.twimg.com/ https://avatars.githubusercontent.com/ https://s3.amazonaws.com/keybase_processed_uploads/ ${
      htmlWebpackPlugin.options.isDev ? 'http://localhost:4000' : ''
    };
    style-src 'unsafe-inline';
    script-src ${
      htmlWebpackPlugin.options.isDev
        ? "file: http://localhost:4000 chrome-extension://react-developer-tools 'unsafe-eval'"
        : "'self'"
    };
    connect-src http://127.0.0.1:* ${
      htmlWebpackPlugin.options.isDev ? 'ws://localhost:4000 http://localhost:4000' : ''
    };
        ">
    </head>
    <body>
        <div id="root">
            <div title="loading..." style="flex: 1;background-color: #f5f5f5"></div>
        </div>
        <div id="modal-root"></div>
        ${htmlWebpackPlugin.files.js.map(js => `<script src="${js}"></script>`).join('\n')} </body>
</html>
              `,
          })
      ),
    ].filter(Boolean)

  // just keeping main in its old place
  const entryOverride = {main: 'desktop/renderer'}

  // multiple entries so we can chunk shared parts
  const entries = ['main', 'menubar', 'pinentry', 'unlock-folders', 'tracker2']
  const viewConfig = merge(commonConfig, {
    devServer: {
      compress: false,
      hot: isHot,
      port: 4000,
      devMiddleware: {
        publicPath: 'http://localhost:4000/dist',
      },
      client: {
        overlay: true,
        webSocketURL: {
          hostname: 'localhost',
          pathname: '/ws',
          port: 4000,
        },
      },
      static: {
        directory: path.resolve(__dirname, 'dist'),
        publicPath: '/dist',
      },
    },
    entry: entries.reduce((map, name) => {
      map[name] = `./${entryOverride[name] || name}/main.desktop.tsx`
      return map
    }, {}),
    externals: {
      ...(isDev ? {} : {}),
    },
    module: {rules: makeRules(false)},
    name: 'Keybase',
    ...(isHot
      ? {}
      : {
          optimization: {splitChunks: {chunks: 'all'}},
        }),
    plugins: makeViewPlugins(entries),
    resolve: {
      alias: {
        ...commonConfig.resolve.alias,
        'path-parse': false,
      },
      fallback: {process: false},
    },
    target: 'web',
    node: false,
  })
  const preloadConfig = merge(commonConfig, {
    entry: {preload: `./desktop/renderer/preload.desktop.tsx`},
    module: {rules: makeRules(true)},
    name: 'Keybase',
    plugins: [],
    target: 'electron-preload',
  })

  return [nodeConfig, viewConfig, preloadConfig]
}

export default config
