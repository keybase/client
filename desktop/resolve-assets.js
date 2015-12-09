import path from 'path'

// This changes depending on if we're in the main thread or renderers....
let app = require('electron').app
if (!app) {
  app = require('electron').remote.app
}

let root = process.cwd()
if (process.env.NODE_ENV === 'production') {
  root = path.join(app.getAppPath(), 'desktop')
}

export default function (to) {
  return path.resolve(path.join(root, to))
}
