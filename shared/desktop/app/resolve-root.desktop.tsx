// import {isWindows} from '../../constants/platform'
// const {electron, path, __dirname} = KB
// const {join, resolve, sep} = path
// const {appPath} = electron.app

// const root = !__DEV__ ? KB.path.join(KB.constants.appPath, './desktop') : KB.path.join(__dirname, '..')
// const root = KB.constants.resolveRoot
// const prefix = KB.constants.isWindows ? 'file:///' : 'file://'

// if (__STORYBOOK__) {
//   root = resolve(join(__dirname, '..', '..'))
//   prefix = ''
// } else {
// Gives a path to the desktop folder in dev/packaged builds. Used to load up runtime assets.
// root = !__DEV__ ? KB.path.join(appPath, './desktop') : KB.path.join(__dirname, '..')
// }

// const fixRegExp = new RegExp('\\' + KB.constants.pathSep, 'g')

// const fixPath =
//   KB.constants.pathSep === '/' ? (s: string) => s : (s: string) => (s ? s.replace(fixRegExp, '/') : s)
// const fix = (s: string) => encodeURI(fixPath(s))

// const imageRoot = KB.path.resolve(root, '..', 'images')

// export const resolveRoot = (...to: Array<string>) => KB.path.resolve(root, ...to)
// export const resolveRootAsURL = (...to: Array<string>) => `${prefix}${fix(resolveRoot(resolveRoot(...to)))}`
// export const resolveImage = (...to: Array<string>) => KB.path.join(imageRoot, ...to)
// export const resolveImageAsURL = (...to: Array<string>) => `${prefix}${fix(resolveImage(...to))}`

// export default resolveRoot

export const {resolveImage, resolveImageAsURL, resolveRoot, resolveRootAsURL} = KB.functions
export default KB.functions.resolveRoot
