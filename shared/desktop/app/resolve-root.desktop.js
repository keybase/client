// @flow
import * as Path from '../../util/path.desktop'
import * as SafeElectron from '../../util/safe-electron.desktop'
import {isWindows} from '../../constants/platform'

let root
let prefix = isWindows ? 'file:///' : 'file://'

if (__STORYBOOK__) {
  root = Path.resolve(Path.join(__dirname, '..', '..'))
  prefix = ''
} else {
  // Gives a path to the desktop folder in dev/packaged builds. Used to load up runtime assets.
  root = !__DEV__ ? Path.join(SafeElectron.getApp().getAppPath(), './desktop') : Path.join(__dirname, '..')
}

const fixRegExp = new RegExp('\\' + Path.sep, 'g')

const fixPath = Path.sep === '/' ? s => s : s => (s ? s.replace(fixRegExp, '/') : s)
const fix = s => encodeURI(fixPath(s))

const imageRoot = Path.resolve(root, '..', 'images')

export const resolveRoot = (...to: any) => Path.resolve(root, ...to)
export const resolveRootAsURL = (...to: any) => `${prefix}${fix(resolveRoot(resolveRoot(...to)))}`
export const resolveImage = (...to: any) => Path.join(imageRoot, ...to)
export const resolveImageAsURL = (...to: any) => `${prefix}${fix(resolveImage(...to))}`

export default resolveRoot
