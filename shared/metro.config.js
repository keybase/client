const {getDefaultConfig} = require('expo/metro-config')
const path = require('path')
const ignoredModules = require('./ignored-modules')

const root = path.resolve(__dirname, '.')
const nullModule = path.join(root, 'null-module.js')

const config = getDefaultConfig(__dirname)

config.resolver = {
  ...config.resolver,
  assetExts: [...config.resolver.assetExts, 'css'],
  sourceExts: [...config.resolver.sourceExts, 'css'],
  extraNodeModules: ignoredModules.reduce((acc, name) => {
    acc[name] = nullModule
    return acc
  }, {}),
}

module.exports = config
