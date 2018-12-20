// @flow
const modulePaths = require('./modulePaths')
const resolve = require('path').resolve
const fs = require('fs')
const path = require('path')

console.log('setting the config for the packager here!!!')

// Update the following line if the root folder of your app is somewhere else.
const ROOT_FOLDER = path.resolve(__dirname, '..')

const config = {
  projectRoot: ROOT_FOLDER,
  transformer: {
    getTransformOptions: () => {
      const moduleMap = {}
      modulePaths.forEach(path => {
        if (fs.existsSync(path)) {
          moduleMap[resolve(path)] = true
        }
      })
      return {
        preloadedModules: moduleMap,
        transform: {inlineRequires: {blacklist: moduleMap}},
      }
    },
  },
}

module.exports = config
