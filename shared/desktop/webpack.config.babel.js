/* Our bundler for the desktop app.
 * We build:
 * Electron main thread / render threads for the main window and remote windows (menubar, trackers, etc)
 */
import TerserPlugin from 'terser-webpack-plugin'
import merge from 'webpack-merge'
import path from 'path'
import webpack from 'webpack'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin'

const ignoredModules = require('../ignored-modules')
const enableWDYR = require('../util/why-did-you-render-enabled')
const elecVersion = require('../package.json').devDependencies.electron
// true if you want to debug unused code. This makes single chunks so you can grep for 'unused harmony' in the output in desktop/dist
const debugUnusedChunks = false
const evalDevtools = false

if (enableWDYR || debugUnusedChunks || evalDevtools) {
  console.error('*** Webpack debugging on! ***', {enableWDYR, debugUnusedChunks, evalDevtools})
}

const config = (_, {mode}) => {
  const isDev = mode !== 'production'
  const isHot = isDev && !!process.env['HOT']
  const isProfile = !isDev && !!process.env['PROFILE']
  if (isProfile) {
    console.warn('*** Webpack profiling on ***')
  }

  const fileSuffix = isDev ? '.dev' : isProfile ? '.profile' : ''

  console.error('Flags: ', {isDev, isHot, isProfile})
  console.error('Detected electron from package.json: ', elecVersion)

  const makeRules = nodeThread => {
    const babelRule = {
      loader: 'babel-loader',
      options: {
        cacheDirectory: true,
        ignore: [/\.(native|ios|android)\.(ts|js)x?$/],
        plugins: [
          ['module-resolver', {alias: {'@': './'}}],
          ...(isHot && !nodeThread ? ['react-refresh/babel'] : []),
        ],
        presets: [
          ['@babel/preset-env', {debug: false, modules: false, targets: {electron: elecVersion}}],
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
      ...(isDev && enableWDYR
        ? []
        : [
            {
              // Don't include why-did-you-render
              include: /welldone/,
              test: /\.(ts|js)x?$/,
              use: ['null-loader'],
            },
          ]),
      {
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false, // disable the behaviour
        },
      },
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
        exclude: /\/dist\//,
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

  const defines = {
    __FILE_SUFFIX__: JSON.stringify(fileSuffix),
    __PROFILE__: isProfile,
    __DEV__: isDev,
    __HOT__: isHot,
    __VERSION__: isDev ? JSON.stringify('Development') : JSON.stringify(process.env.APP_VERSION),
  }
  console.warn('Injecting defines: ', defines)

  const alias = ignoredModules.reduce(
    (acc, name) => {
      acc[name] = path.resolve(__dirname, '../null-module.js')
      return acc
    },
    {
      'react-native$': 'react-native-web',
      'react-native-reanimated': false,
    }
  )

  if (!isDev) {
    alias['@welldone-software/why-did-you-render'] = false
  }

  const commonConfig = {
    bail: true,
    context: path.resolve(__dirname, '..'),
    devtool: evalDevtools ? 'eval' : isDev ? 'cheap-module-source-map' : 'source-map',
    mode: isDev ? 'development' : 'production',
    node: false,
    output: {
      filename: `[name]${fileSuffix}.bundle.js`,
      path: path.resolve(__dirname, 'dist'),
      publicPath,
    },
    plugins: [
      new webpack.DefinePlugin(defines),
      new webpack.IgnorePlugin({resourceRegExp: /^\.\/locale$/, contextRegExp: /moment$/}),
      ...(enableWDYR ? [] : [new webpack.IgnorePlugin({resourceRegExp: /^lodash$/})]),
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
              new TerserPlugin({
                parallel: true,
                terserOptions: {
                  parse: {ecma: 2020},
                  compress: {
                    comparisons: false,
                    ecma: 2020,
                    inline: 2,
                  },
                  keep_fnames: true,
                  keep_classnames: true,
                  mangle: false,
                  output: {comments: false},
                },
              }),
            ],
          },
        }),
  }

  const nodeConfig = merge(commonConfig, {
    entry: {node: './desktop/app/node.desktop.tsx'},
    module: {rules: makeRules(true)},
    name: 'node',
    plugins: [
      // Ensure the view layer doesn't bleed into the node layer
      new webpack.IgnorePlugin({resourceRegExp: /^react$/}),
    ],
    stats: {
      usedExports: isDev ? undefined : false,
    },
    target: 'electron-main',
  })

  const makeViewPlugins = names =>
    [
      ...(debugUnusedChunks
        ? [
            new webpack.optimize.LimitChunkCountPlugin({
              maxChunks: 1,
            }),
          ]
        : []),
      // needed to help webpack and electron renderer
      new webpack.DefinePlugin({
        global: 'globalThis',
        'process.env.NODE_DEBUG': JSON.stringify(process.env.NODE_DEBUG),
      }),
      ...(isHot ? [new ReactRefreshWebpackPlugin({forceEnable: true})] : []),
      ...names.map(
        name =>
          new HtmlWebpackPlugin({
            chunks: [name],
            filename: `${name}${fileSuffix}.html`,
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
        ? "file: http://localhost:4000 http://localhost:8097 'unsafe-eval'"
        : "'self'"
    };
    connect-src http://127.0.0.1:* ${
      htmlWebpackPlugin.options.isDev ? 'ws://localhost:4000 http://localhost:4000 ws://localhost:8097' : ''
    };
        ">
    </head>
${htmlWebpackPlugin.options.isDev && name === 'main' ? '<script src="http://localhost:8097"></script>' : ''}
    <body>
        <div id="root">
            <div title="loading..." style="flex: 1"></div>
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
  const entries = debugUnusedChunks ? ['main'] : ['main', 'menubar', 'pinentry', 'unlock-folders', 'tracker']
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
    module: {rules: makeRules(false)},
    name: 'Keybase',
    ...(isHot
      ? {}
      : {
          optimization: {
            splitChunks: {chunks: 'all'},
            ...(debugUnusedChunks ? {usedExports: true} : {}),
          },
        }),
    plugins: makeViewPlugins(entries),
    resolve: {
      alias: {
        ...commonConfig.resolve.alias,
        'path-parse': false,
      },
      fallback: {process: false, url: false},
    },
    target: 'web',
  })
  const preloadConfig = merge(commonConfig, {
    entry: {preload: `./desktop/renderer/preload.desktop.tsx`},
    module: {rules: makeRules(true)},
    name: 'preload',
    plugins: [],
    target: 'electron-preload',
  })

  return [nodeConfig, viewConfig, preloadConfig]
}

export default config
