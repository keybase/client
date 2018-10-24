// @flow
// Special pre-load file for the main app
// TODO going to have to bundle this
const {writeLogLinesToFile, deleteOldLog} = require('./logging.desktop')
console.log('aaa preload start')
const _url = require('url')
const _events = require('events')
const _path = require('path')

const globalScope = typeof window === 'undefined' ? global : window

console.log('aaa setting global keybase')

globalScope.keybase = {
  _debugFs: require('fs'), // TODO not in prod bundle
  writeLogLinesToFile,
  deleteOldLog,
  // writeLogLinesToFile: () => {
  // throw new Error('Injected later in logging.desktop')
  // },
  // deleteOldLog: () => {
  // throw new Error('Injected later in logging.desktop')
  // },
  path: {
    basename: _path.basename,
    dirname: _path.dirname,
    extname: _path.extname,
    isAbsolute: _path.isAbsolute,
    join: _path.join,
    resolve: _path.resolve,
    sep: _path.sep,
  },
  process: {
    env: process.env,
    platform: process.platform,
  },
}

console.log('aaa setting global keybase, done', globalScope.keybase)

globalScope.require = name => {
  switch (name) {
    // debug only
    case 'url':
      return _url
    // debug only
    case 'events':
      return _events
    default:
      throw new Error("You can't require! " + name)
  }
}
console.log('aaa preload end')
