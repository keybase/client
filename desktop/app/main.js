// This file is ES5; it's loaded before Babel.
require('babel/register')({
  extensions: ['.desktop.js', '.es6', '.es', '.jsx', '.js']
})

const menubar = require('menubar')
const ipc = require('ipc')
const Window = require('./window')

const mb = menubar({
  index: `file://${__dirname}/../renderer/launcher.html`,
  width: 200, height: 250,
  preloadWindow: true,
  icon: 'Icon.png'
})

const trackerWindow = new Window('tracker', {
  width: 500, height: 300,
  resizable: false,
  fullscreen: false,
  frame: false
})

const mainWindow = new Window('index', {
  width: 1600, height: 1200, openDevTools: true
})

mb.on('ready', () => {
  require('../../react-native/react/native/notifications').init()
})

// Work around an OS X bug that leaves a gap in the status bar if you exit
// without removing your status bar icon.
if (process.platform === 'darwin') {
  mb.app.on('quit', () => { mb.tray.destroy() })
}

ipc.on('showMain', () => { mainWindow.show() })
ipc.on('showTracker', () => { trackerWindow.show() })
