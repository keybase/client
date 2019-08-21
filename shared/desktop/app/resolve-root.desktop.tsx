import {isWindows} from '../../constants/platform'

let root: string
let prefix = isWindows ? 'file:///' : 'file://'

if (__STORYBOOK__) {
  root = KB.path.resolve(KB.path.join(KB.__dirname, '..', '..'))
  prefix = ''
} else {
  // Gives a path to the desktop folder in dev/packaged builds. Used to load up runtime assets.
  root = !__DEV__ ? KB.path.join(KB.electron.app.getAppPath(), './desktop') : KB.path.join(KB.__dirname, '..')
}

const fixRegExp = new RegExp('\\' + KB.path.sep, 'g')

const fixPath = KB.path.sep === '/' ? (s: string) => s : (s: string) => (s ? s.replace(fixRegExp, '/') : s)
const fix = (s: string) => encodeURI(fixPath(s))

const imageRoot = KB.path.resolve(root, '..', 'images')

export const resolveRoot = (...to: any) => KB.path.resolve(root, ...to)
export const resolveRootAsURL = (...to: any) => `${prefix}${fix(resolveRoot(resolveRoot(...to)))}`
export const resolveImage = (...to: any) => KB.path.join(imageRoot, ...to)
export const resolveImageAsURL = (...to: any) => `${prefix}${fix(resolveImage(...to))}`

export default resolveRoot
