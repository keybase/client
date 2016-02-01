import path from 'path'

// Gives a path to the desktop folder in dev/packaged builds. Used to load up runtime assets.

// This changes depending on if we're in the main thread or renderers....
let app = require('electron').app
if (!app) {
  app = require('electron').remote.app
}

let root = null

/* eslint-disable no-undef */ // Injected by webpack
if (!__DEV__) {
/* eslint-enable no-undef */
  root = path.join(app.getAppPath(), './desktop')
} else {
  root = path.join(__dirname)
}

export default function (to) {
  return path.resolve(root, to)
}
