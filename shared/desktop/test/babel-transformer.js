// @flow
const path = require('path')
const fs = require('fs')

const babelrcPath = path.join(__dirname, '../.babelrc')
const babelConfig = JSON.parse(fs.readFileSync(babelrcPath, 'utf8'))
babelConfig.presets = babelConfig.presets.map(require.resolve)
babelConfig.plugins = babelConfig.plugins.filter(n => n !== 'babel-plugin-transform-runtime' && n !== 'react-hot-loader/babel')
babelConfig.plugins = babelConfig.plugins.map(name => {
  if (typeof name === 'string') {
    return require.resolve(name)
  } else {
    return [require.resolve(name[0]), name[1]]
  }
})

module.exports = require('babel-jest').createTransformer(babelConfig)
