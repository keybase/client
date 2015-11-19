import BrowserWindow from 'browser-window'
import showDockIcon from './dockIcon'

export default class Window {
  constructor (filename, opts) {
    this.filename = filename
    this.opts = opts || {}
    this.window = null
    this.releaseDockIcon = null
  }

  show () {
    if (this.window) {
      if (!this.window.isFocused()) {
        this.window.focus()
      }
      return
    }

    this.window = new BrowserWindow(this.opts)
    this.releaseDockIcon = showDockIcon()
    this.window.loadUrl(`file://${__dirname}/../renderer/${this.filename}.html`)

    this.window.on('closed', () => {
      this.window = null
      if (this.releaseDockIcon) {
        this.releaseDockIcon()
        this.releaseDockIcon = null
      }
    })

    if (this.opts.openDevTools) {
      this.window.openDevTools()
    }
  }
}
