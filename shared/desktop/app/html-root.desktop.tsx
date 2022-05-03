import {app} from 'electron'
import path from 'path'

const isWindows = process.platform === 'win32'
export const htmlPrefix = isWindows ? `file:///` : `file://`
export const assetRoot =
  path.resolve(__DEV__ ? './desktop/dist' : path.join(app.getAppPath(), './desktop/dist')) + '/'
