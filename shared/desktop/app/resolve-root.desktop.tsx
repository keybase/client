import path from 'path'
import * as SafeElectron from '../../util/safe-electron.desktop'
import {isWindows} from '../../constants/platform'

let root
let prefix = isWindows ? 'file:///' : 'file://'

if (__STORYBOOK__) {
  root = path.resolve(path.join(__dirname, '..', '..'))
  prefix = ''
} else {
  // Gives a path to the desktop folder in dev/packaged builds. Used to load up runtime assets.
  root = !__DEV__ ? path.join(SafeElectron.getApp().getAppPath(), './desktop') : path.join(__dirname, '..')
}

const fixRegExp = new RegExp('\\' + path.sep, 'g')

const fixPath = path.sep === '/' ? s => s : s => (s ? s.replace(fixRegExp, '/') : s)
const fix = s => encodeURI(fixPath(s))

const imageRoot = path.resolve(root, '..', 'images')

export const resolveRoot = (...to: any) => path.resolve(root, ...to)
export const resolveRootAsURL = (...to: any) => `${prefix}${fix(resolveRoot(resolveRoot(...to)))}`
export const resolveImage = (...to: any) => path.join(imageRoot, ...to)
export const resolveImageAsURL = (...to: any) => `${prefix}${fix(resolveImage(...to))}`

export default resolveRoot
