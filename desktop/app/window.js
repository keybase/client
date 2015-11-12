const BrowserWindow = require('browser-window')

export default class Window {
  constructor (filename, opts) {
    this.filename = filename
    this.opts = opts || {}
    this.window = null
  }

  show () {
    if (this.window) {
      this.window.focus()
      return
    }
    this.window = new BrowserWindow(this.opts)
    this.window.loadUrl(`file://${__dirname}/../renderer/${this.filename}.html`)
    this.window.on('closed', () => { this.window = null })
    if (this.opts.openDevTools) {
      this.window.openDevTools()
    }
  }
}
