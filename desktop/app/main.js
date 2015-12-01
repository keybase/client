// This file is ES5; it's loaded before Babel.
require('babel/register')({
  extensions: ['.desktop.js', '.es6', '.es', '.jsx', '.js']
})

const menubar = require('menubar')
const ipc = require('electron').ipcMain
const Window = require('./window')
const splash = require('./splash')
const installer = require('./installer')
const app = require('electron').app
const path = require('path')

const appPath = app.getAppPath()
const menubarIconPath = path.resolve(appPath, "Icon.png")

const mb = menubar({
  index: `file://${__dirname}/../renderer/launcher.html`,
  width: 200, height: 250,
  preloadWindow: true,
  icon: menubarIconPath,
  showDockIcon: true
})

const mainWindow = new Window('index', {
  width: 1600,
  height: 1200,
  openDevTools: true
})

mb.on('ready', () => {
  require('../../react-native/react/native/notifications').init()
  require('../../react-native/react/native/pinentry').init()
})

// Work around an OS X bug that leaves a gap in the status bar if you exit
// without removing your status bar icon.
if (process.platform === 'darwin') {
  mb.app.on('quit', () => { mb.tray.destroy() })
}

ipc.on('showMain', () => { mainWindow.show(true) })

installer((err) => {
  if (err) console.log("Error: ", err)
  splash()
})
