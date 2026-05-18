const {getDefaultConfig} = require('expo/metro-config')
const path = require('path')
const ignoredModules = require('./ignored-modules')
const desktopOnlyModules = require('./desktop-only-modules')

const root = path.resolve(__dirname, '.')
const nullModule = path.join(root, 'null-module.js')

const config = getDefaultConfig(__dirname)

const desktopOnlySet = new Set(desktopOnlyModules)

config.resolver = {
  ...config.resolver,
  assetExts: [...config.resolver.assetExts, 'css'],
  sourceExts: [...config.resolver.sourceExts, 'css'],
  extraNodeModules: ignoredModules.reduce((acc, name) => {
    acc[name] = nullModule
    return acc
  }, {}),
  resolveRequest: (context, moduleName, platform) => {
    // Null out desktop-only packages and any explicit .desktop platform imports
    if (desktopOnlySet.has(moduleName) || moduleName.endsWith('.desktop')) {
      return {type: 'sourceFile', filePath: nullModule}
    }
    return context.resolveRequest(context, moduleName, platform)
  },
}

module.exports = config
