import path from 'path'
import * as Electron from 'electron'

const isRenderer = typeof process !== 'undefined' && process.type === 'renderer'
const target = isRenderer ? window : global
const {argv, platform, env, type} = process
// @ts-ignore
const pid = isRenderer ? Electron.remote.process.pid : process.pid

const kbProcess = {
  argv,
  env,
  pid,
  platform,
  type,
}

target.KB = {
  __dirname: __dirname,
  electron: {
    app: {
      appPath: __STORYSHOT__ ? '' : isRenderer ? Electron.remote.app.getAppPath() : Electron.app.getAppPath(),
    },
  },
  path: {
    basename: path.basename,
    extname: path.extname,
    join: path.join,
    resolve: path.resolve,
    sep: path.sep,
  },
  process: kbProcess,
  // punycode, // used by a dep
}

if (isRenderer) {
  // have to do this else electron blows away process after the initial preload, use this to add it back
  setTimeout(() => {
    window.KB.process = kbProcess
  }, 0)
}
