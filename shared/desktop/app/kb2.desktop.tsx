// implementation of KB2, requires node context! preload will proxy this with the contextBridge
import {app} from 'electron'
import path from 'path'

const kb2: typeof global.KB2 = {
  assetRoot: path.resolve(__DEV__ ? '.' : app.getAppPath()),
}
export default kb2
