const {getDefaultConfig} = require('expo/metro-config')
const path = require('path')
const ignoredModules = require('./ignored-modules')
const desktopOnlyModules = require('./desktop-only-modules')

const root = path.resolve(__dirname, '.')
const rootRe = root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  new RegExp(`^${rootRe}/tests/results/`),
  new RegExp(`^${rootRe}/\\.maestro/`),
  new RegExp(`^${rootRe}/desktop/`),
  new RegExp(`^${rootRe}/ios/build/`),
  new RegExp(`^${rootRe}/ios/Pods/`),
  new RegExp(`^${rootRe}/ios/dist/`),
  new RegExp(`^${rootRe}/android/app/build/`),
  new RegExp(`^${rootRe}/android/build/`),
  new RegExp(`^${rootRe}/android/\\.gradle/`),
  new RegExp(`^${rootRe}/docs/`),
  new RegExp(`^${rootRe}/coverage-ts/`),
  new RegExp(`^${rootRe}/patches/`),
  new RegExp(`^${rootRe}/scripts/`),
  new RegExp(`^${rootRe}/tools/`),
]

module.exports = config
