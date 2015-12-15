import path from 'path'

// This changes depending on if we're in the main thread or renderers....
let app = require('electron').app
if (!app) {
  app = require('electron').remote.app
}

let root = process.cwd()

/* eslint-disable no-undef */ // Injected by webpack
if (!__DEV__) {
/* eslint-enable no-undef */
  root = path.join(app.getAppPath(), 'desktop')
}

export default function (to) {
  return path.resolve(path.join(root, to))
}
