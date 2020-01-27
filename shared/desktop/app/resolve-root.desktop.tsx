import * as SafeElectron from '../../util/safe-electron.desktop'
import {isWindows} from '../../constants/platform'

let root
let prefix = isWindows ? 'file:///' : 'file://'

if (__STORYBOOK__) {
  root = KB.__path.resolve(KB.__path.join(KB.__dirname, '..', '..'))
  prefix = ''
} else {
  // Gives a path to the desktop folder in dev/packaged builds. Used to load up runtime assets.
  root = !__DEV__
    ? KB.__path.join(SafeElectron.getApp().getAppPath(), './desktop')
    : KB.__path.join(KB.__dirname, '..')
}

const fixRegExp = new RegExp('\\' + KB.__path.sep, 'g')

const fixPath = KB.__path.sep === '/' ? s => s : s => (s ? s.replace(fixRegExp, '/') : s)
const fix = s => encodeURI(fixPath(s))

const imageRoot = KB.__path.resolve(root, '..', 'images')

export const resolveRoot = (...to: any) => KB.__path.resolve(root, ...to)
export const resolveRootAsURL = (...to: any) => `${prefix}${fix(resolveRoot(resolveRoot(...to)))}`
export const resolveImage = (...to: any) => KB.__path.join(imageRoot, ...to)
export const resolveImageAsURL = (...to: any) => `${prefix}${fix(resolveImage(...to))}`

export default resolveRoot
