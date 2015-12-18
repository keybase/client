// Can't tell which thread we're in so let's try both
const electron = require('electron')

const Menu = electron.Menu || electron.remote.Menu
const app = electron.app || electron.remote.app
const shell = electron.shell || electron.remote.shell

export default function makeMenu (window) {
  if (process.platform === 'darwin') {
    const template = [{
      label: 'Keybase',
      submenu: [
        {label: 'About Keybase', role: 'about'},
        {type: 'separator'},
        {label: 'Hide Keybase', accelerator: 'CmdOrCtrl+H', role: 'hide'},
        {label: 'Hide Others', accelerator: 'CmdOrCtrl+Shift+H', role: 'hideothers'},
        {label: 'Show All', role: 'unhide'},
        {type: 'separator'},
        {label: 'Quit', accelerator: 'CmdOrCtrl+Q', click () { app.quit() }}
      ]
    }, {
      label: 'Edit',
      submenu: [
        {label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo'},
        {label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo'},
        {type: 'separator'},
        {label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut'},
        {label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy'},
        {label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste'},
        {label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectall'}
      ]
    }, {
      label: 'Window',
      submenu: [
        {label: 'Minimize', accelerator: 'CmdOrCtrl+M', role: 'minimize'},
        {label: 'Close', accelerator: 'CmdOrCtrl+W', role: 'close'},
        {type: 'separator'},
        {label: 'Bring All to Front', role: 'front'}
      ]
    }, {
      label: 'Help',
      submenu: [
        {label: 'Learn More', click () { shell.openExternal('https://keybase.io') }}
      ]
    }]
    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
  } else {
    const template = [{
      label: '&File',
      submenu: [
        {label: '&Close', accelerator: 'CmdOrCtrl+W', click () { this.remoteWindow.close() }}
      ]
    }, {
      label: 'Help',
      submenu: [{label: 'Learn More', click () { shell.openExternal('https://keybase.io') }}]
    }]
    const menu = Menu.buildFromTemplate(template)
    window.setMenu(menu)
  }
}
