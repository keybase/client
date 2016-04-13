import path from 'path'
import electron from 'electron'

// Gives a path to the desktop folder in dev/packaged builds. Used to load up runtime assets.

const app = electron.app || electron.remote.app
let root = null

if (!__DEV__) { // eslint-disable-line no-undef
  root = path.join(app.getAppPath(), './desktop')
} else {
  root = path.join(__dirname)
}

function fix (str) {
  return encodeURI(str && str.replace(new RegExp('\\' + path.sep, 'g'), '/'))
}

export const resolveRoot = (...to) => path.resolve(root, ...to)
export const resolveRootAsURL = (...to) => `file://${fix(resolveRoot(resolveRoot(...to)))}`
export const resolveImage = (...to) => path.resolve(root, 'shared', 'images', ...to)
export const resolveImageAsURL = (...to) => `file://${fix(resolveImage(...to))}`

export default resolveRoot
