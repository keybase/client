// This file is ES5; it's loaded before Babel.
var app = require('app')
var BrowserWindow = require('browser-window')
var mainWindow = null

app.on('window-all-closed', function () {
  app.quit()
})

app.on('ready', function() {
  mainWindow = new BrowserWindow({width: 1600, height: 1200})
  var filename = 'file://' + __dirname + '/../renderer/index.html'
  mainWindow.loadUrl(filename)
  mainWindow.openDevTools()
  mainWindow.on('closed', function () {
    mainWindow = null
  })
})
