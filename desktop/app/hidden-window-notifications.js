import Window from './window'
// TODO: move this to the main renderer

// Electron doesn't currently support showing notifications from the main
// process, so we'll use a hidden window to show them for us.
// https://github.com/atom/electron/issues/3359
const window = new Window('notifier', {show: false})
window.createWindow()

export default function (title, opts) {
  window.window.webContents.send('notify', title, opts)
}
