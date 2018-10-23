// @flow
// Special pre-load file for the main app
import {writeLogLinesToFile, deleteOldLog} from './logging.desktop'
const _url = require('url')
const _events = require('events')
const _path = require('path')

const globalScope = typeof window === 'undefined' ? global : window

globalScope.keybase = {
  _debugFs: __DEV__ && require('fs'),
  writeLogLinesToFile,
  deleteOldLog,
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
