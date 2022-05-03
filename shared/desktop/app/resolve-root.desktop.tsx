// import {isWindows} from '../../constants/platform'
// const {electron, path, __dirname} = KB
// const {join, resolve} = path
// const {appPath} = electron.app
const root = KB2.assetRoot
// __DEV__ ? '../..' : join(appPath, './desktop')
// let prefix = isWindows ? 'file:///' : 'file://'
// Gives a path to the desktop folder in dev/packaged builds. Used to load up runtime assets.
// const fixRegExp = new RegExp('\\' + sep, 'g')
// const fixPath = sep === '/' ? (s: string) => s : (s: string) => (s ? s.replace(fixRegExp, '/') : s)
// const fix = (s: string) => encodeURI(fixPath(s))
// const imageRoot = resolve(root, '..', 'images')

export const resolveRoot = (...to: Array<string>) => [root, ...to].join('/')
// export const resolveRootAsURL = (...to: Array<string>) => `${prefix}${fix(resolveRoot(resolveRoot(...to)))}`
// export const resolveImage = (...to: Array<string>) => join(imageRoot, ...to)
// export const resolveImage = (...to: Array<string>) => `../../images/${to.join('/')}`

export default resolveRoot
