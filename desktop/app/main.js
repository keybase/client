// This file is ES5; it's loaded before Babel.
require('babel/register')({
  extensions: ['.desktop.js', '.es6', '.es', '.jsx', '.js']
})

const app = require('app')
const ipc = require('ipc')
const Window = require('./window')

const trackerWindow = new Window('tracker', {
  width: 500, height: 300,
  resizable: false,
  fullscreen: false,
  frame: false
})

const launcherWindow = new Window('launcher', {
  title: 'Keybase',
  width: 200, height: 250,
  x: 50, y: 50,
  resizable: false,
  fullscreen: false,
  'use-content-size': true
})

const mainWindow = new Window('index', {
  width: 1600, height: 1200, openDevTools: true
})

app.on('ready', function () {
  launcherWindow.show()
  launcherWindow.window.on('closed', () => { app.quit() })
  require('../../react-native/react/native/notifications').init()
})

ipc.on('showMain', () => { mainWindow.show() })
ipc.on('showTracker', () => { trackerWindow.show() })
