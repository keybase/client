// eslint-disable-next-line
const upstreamTransformer = require('metro-react-native-babel-transformer')

module.exports.transform = function(p) {
  if (p.filename.endsWith('css')) {
    return upstreamTransformer.transform({
      filename: p.filename,
      options: p.options,
      src: 'module.export = ""',
    })
  }
  return upstreamTransformer.transform(p)
}
