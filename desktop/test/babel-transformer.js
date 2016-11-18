// @flow
const fs = require('fs')

const babelConfig = JSON.parse(fs.readFileSync('.babelrc', 'utf8'))
babelConfig.presets = babelConfig.presets.map(require.resolve)
babelConfig.plugins = babelConfig.plugins.filter(n => n !== 'babel-plugin-transform-runtime' && n !== 'react-hot-loader/babel')
babelConfig.plugins = babelConfig.plugins.map(name => {
  if (typeof name === 'string') {
    return require.resolve(name)
  } else {
    return [require.resolve(name[0]), name[1]]
  }
})

// FIXME: Horrible hack to override cwd passed to babel-plugin-istanbul because
// it ignores files outside of its notion of cwd (such as our shared dir).
babelConfig.plugins.concat = function (plugin) {
  return Array.prototype.concat.call(this, [[plugin, {cwd: '..'}]])
}

module.exports = require('babel-jest').createTransformer(babelConfig)
