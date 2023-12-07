// eslint-disable-next-line
const upstreamTransformer = require('metro-react-native-babel-transformer')
const enableWDYR = require('./util/why-did-you-render-enabled')

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

  if (!enableWDYR && p.filename.indexOf('welldone') !== -1) {
    return upstreamTransformer.transform({
      filename: p.filename,
      options: p.options,
      src: 'module.export = "" // why-did-you-render disabled in rn-transformer',
    })
  }

  return upstreamTransformer.transform(p)
}
