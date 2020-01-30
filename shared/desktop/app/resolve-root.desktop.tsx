import {isWindows} from '../../constants/platform'
const {electron, path, __dirname} = KB
const {join, resolve, sep} = path
const {appPath} = electron.app

let root: string
let prefix = isWindows ? 'file:///' : 'file://'

if (__STORYBOOK__) {
  root = resolve(join(__dirname, '..', '..'))
  prefix = ''
} else {
  // Gives a path to the desktop folder in dev/packaged builds. Used to load up runtime assets.
  root = !__DEV__ ? join(appPath, './desktop') : join(__dirname, '..')
}

const fixRegExp = new RegExp('\\' + sep, 'g')

const fixPath = sep === '/' ? (s: string) => s : (s: string) => (s ? s.replace(fixRegExp, '/') : s)
const fix = (s: string) => encodeURI(fixPath(s))

const imageRoot = resolve(root, '..', 'images')

export const resolveRoot = (...to: Array<string>) => resolve(root, ...to)
export const resolveRootAsURL = (...to: Array<string>) => `${prefix}${fix(resolveRoot(resolveRoot(...to)))}`
export const resolveImage = (...to: Array<string>) => join(imageRoot, ...to)
export const resolveImageAsURL = (...to: Array<string>) => `${prefix}${fix(resolveImage(...to))}`

export default resolveRoot
