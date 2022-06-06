import {app} from 'electron'
import path from 'path'

const isWindows = process.platform === 'win32'
export const htmlPrefix = isWindows ? `file:///` : `file://`
export const assetsRoot = path.resolve(__DEV__ ? '.' : app.getAppPath()).replaceAll(path.sep, '/') + '/'
export const htmlRoot = path.join(assetsRoot, 'desktop/dist').replaceAll(path.sep, '/') + '/'
