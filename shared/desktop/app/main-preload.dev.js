// @flow
// Special pre-load file for the main app
const _url = require('url')
const _events = require('events')
const _path = require('path')

window.keybase = {
  path: {
    dirname: _path.dirname,
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

window.require = name => {
  switch (name) {
    case 'url':
      return _url
    case 'events':
      return _events
    default:
      throw new Error("You can't require! " + name)
  }
}
