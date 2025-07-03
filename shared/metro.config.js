/**
 * Metro configuration for React Native
 * https://reactnative.dev/docs/metro
 * @format
 */
/* eslint-disable */

const {getDefaultConfig} = require('@expo/metro-config')
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

const defaultConfigExpo = getDefaultConfig(__dirname)

const nullModule = path.join(root, 'null-module.js')

const config = defaultConfigExpo
// watch our rnmodules
config.watchFolders = [...defaultConfigExpo.watchFolders, root, path.resolve(__dirname, '../rnmodules')]
config.resolver = {
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
  unstable_enablePackageExports: false,
}

module.exports = config
