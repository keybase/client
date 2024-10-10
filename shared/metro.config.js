/**
 * Metro configuration for React Native
 * https://reactnative.dev/docs/metro
 * @format
 */
/* eslint-disable */

const {getDefaultConfig: getDefaultConfigExpo} = require('@expo/metro-config')
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config')
const path = require('path')
const fs = require('fs')
const exclusionList = require('metro-config/src/defaults/exclusionList')
const ignoredModules = require('./ignored-modules')

const root = path.resolve(__dirname, '.')
const packages = path.resolve(root, '../rnmodules')

// List all packages under `rnmodules/`
const workspaces = fs
  .readdirSync(packages)
  .map(p => path.join(packages, p))
  .filter(p => fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'package.json')))

const modules = []
  .concat(
    ...workspaces.map(it => {
      const pak = JSON.parse(fs.readFileSync(path.join(it, 'package.json'), 'utf8'))

      // We need to make sure that only one version is loaded for peerDependencies
      // So we exclude them at the root, and alias them to the versions in example's node_modules
      return pak.peerDependencies ? Object.keys(pak.peerDependencies) : []
    })
  )
  .sort()

const defaultConfig = getDefaultConfig(__dirname)
const defaultConfigExpo = getDefaultConfigExpo(__dirname)

const nullModule = path.join(root, 'null-module.js')

module.exports = mergeConfig(defaultConfig, defaultConfigExpo, {
  // watch our rnmodules
  watchFolders: [root, path.resolve(__dirname, '../rnmodules')],
  resolver: {
    ...defaultConfigExpo.resolver,
    assetExts: [...defaultConfigExpo.resolver.assetExts, 'css'],
    sourceExts: [...defaultConfigExpo.resolver.sourceExts, 'cjs', 'css'],
    // We need to exclude the peerDependencies we've collected in packages' node_modules
    blacklistRE: exclusionList(
      [].concat(
        ...workspaces.map(it =>
          modules.map(m => new RegExp(`^${escape(path.join(it, 'node_modules', m))}\\/.*$`))
        )
      )
    ),
    // When we import a package from the monorepo, metro won't be able to find their deps
    // We need to specify them in `extraNodeModules` to tell metro where to find them
    extraNodeModules: modules.reduce(
      (acc, name) => {
        acc[name] = path.join(root, 'node_modules', name)
        return acc
      },
      ignoredModules.reduce((acc, name) => {
        acc[name] = nullModule
        return acc
      }, {})
    ),
  },
  transformer: {
    ...defaultConfigExpo.transformer,
    babelTransformerPath: require.resolve('./rn-transformer.js'),
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
    minifierConfig: {
      mangle: {keep_fnames: true},
      compress: {
        keep_fnames: true,
        keep_classnames: true,
      },
    },
  },
})
