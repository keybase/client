// eslint-disable-next-line
const upstreamTransformer = require('@react-native/metro-babel-transformer')

module.exports.transform = function (p) {
  if (p.filename.endsWith('.desktop.tsx')) {
    throw new Error('Electron polluting RN' + p.filename)
  }
  if (p.filename.endsWith('css')) {
    return upstreamTransformer.transform({
      filename: p.filename,
      options: p.options,
      src: 'module.export = "" // css disabled in rn-transformer',
    })
  }

  return upstreamTransformer.transform(p)
}
