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
  extraNodeModules: ignoredModules.reduce((acc, name) => {
    acc[name] = nullModule
    return acc
  }, {}),
  resolveRequest: (context, moduleName, platform) => {
    // Null out desktop-only packages, explicit .desktop platform imports, and CSS (desktop-only)
    if (desktopOnlySet.has(moduleName) || moduleName.endsWith('.desktop') || moduleName.endsWith('.css')) {
      return {type: 'sourceFile', filePath: nullModule}
    }
    return context.resolveRequest(context, moduleName, platform)
  },
}

config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : config.resolver.blockList ? [config.resolver.blockList] : []),
  /tests\/results\//,
  /\.maestro\//,
  /desktop\//,
  /ios\/build\//,
  /ios\/Pods\//,
  /ios\/dist\//,
  /android\/app\/build\//,
  /android\/build\//,
  /android\/\.gradle\//,
  /docs\//,
  /coverage-ts\//,
  /patches\//,
  /scripts\//,
  /tools\//,
]

module.exports = config
