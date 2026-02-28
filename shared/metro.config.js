const {getDefaultConfig} = require('@expo/metro-config')
const path = require('path')
const ignoredModules = require('./ignored-modules')

const root = path.resolve(__dirname, '.')
const defaultConfigExpo = getDefaultConfig(__dirname)

const nullModule = path.join(root, 'null-module.js')

const config = defaultConfigExpo
config.resolver = {
  ...defaultConfigExpo.resolver,
  assetExts: [...defaultConfigExpo.resolver.assetExts, 'css'],
  sourceExts: [...defaultConfigExpo.resolver.sourceExts, 'cjs', 'css'],
  extraNodeModules: ignoredModules.reduce((acc, name) => {
    acc[name] = nullModule
    return acc
  }, {}),
  unstable_enablePackageExports: false,
}

module.exports = config
