const config = require('react-native/packager/rn-cli.config')
const path = require('path')

const projectRoots = config.getProjectRoots().concat(path.resolve(__dirname, './shared'))
const assetRoots = config.getAssetRoots()
const blacklist = config.getBlacklistRE()

module.exports = {
  getProjectRoots () {
    return projectRoots
  },

  getAssetRoots () {
    return assetRoots
  },

  getBlacklistRE () {
    return blacklist
  }
}
