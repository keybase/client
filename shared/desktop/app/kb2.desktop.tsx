// implementation of KB2, requires node context! preload will proxy this with the contextBridge
import {app} from 'electron'
import path from 'path'

const kb2: typeof global.KB2 = {
  // appPath: 'hello',
  assetRoot: path.resolve(__DEV__ ? '.' : app.getAppPath()),
  // pathSep: path.sep
  // uses24HourClock: () => false,
}
export default kb2
