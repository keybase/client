import Window from './window'

// Electron doesn't currently support showing notifications from the main
// process, so we'll use a hidden window to show them for us.
// https://github.com/atom/electron/issues/3359
const window = new Window('notifier', {show: false})
window.show()

export default function (title, opts) {
  window.window.webContents.send('notify', title, opts)
}
