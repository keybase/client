// TODO preload only
import path from 'path'
import * as SafeElectron from '../../util/safe-electron.desktop'
import {isWindows} from '../../constants/platform'

let root: string
let prefix: string

if (__STORYBOOK__) {
  root = path.resolve(path.join(__dirname, '..', '..'))
  prefix = ''
} else {
  // Gives a path to the desktop folder in dev/packaged builds. Used to load up runtime assets.
  root = !__DEV__ ? path.join(SafeElectron.getApp().getAppPath(), './desktop') : path.join(__dirname, '..')
  prefix = isWindows ? 'file:///' : 'file://'
}

const fixRegExp = new RegExp('\\' + path.sep, 'g')

const fixPath = path.sep === '/' ? (s: string) => s : (s: string) => (s ? s.replace(fixRegExp, '/') : s)
const fix = (s: string) => encodeURI(fixPath(s))

const imageRoot = path.resolve(root, '..', 'images')

export const resolveRoot = (...to: Array<string>) => path.resolve(root, ...to)
export const resolveRootAsURL = (...to: Array<string>) => `${prefix}${fix(resolveRoot(resolveRoot(...to)))}`
export const resolveImage = (...to: Array<string>) => path.join(imageRoot, ...to)
export const resolveImageAsURL = (...to: Array<string>) => `${prefix}${fix(resolveImage(...to))}`

export default resolveRoot
