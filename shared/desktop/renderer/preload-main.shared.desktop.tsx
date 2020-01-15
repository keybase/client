import path from 'path'
import * as Electron from 'electron'

const isRenderer = typeof process !== 'undefined' && process.type === 'renderer'
const target = isRenderer ? window : global
const {platform, env} = process

target.KB = {
  __dirname: __dirname,
  electron: {
    app: {
      getAppPath: isRenderer ? Electron.remote.app.getAppPath : Electron.app.getAppPath,
    },
  },
  path: {
    join: path.join,
    resolve: path.resolve,
    sep: path.sep,
  },
  // punycode, // used by a dep
}

if (isRenderer) {
  // have to do this else electron blows away process
  setTimeout(() => {
    // @ts-ignore
    window.process = {
      env,
      platform,
    }
  }, 0)
}
