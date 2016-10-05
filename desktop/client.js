// @flow
const http = require('http')
const fs = require('fs')
const spawn = require('child_process').spawn
const electron = require('electron-prebuilt')

try {
  fs.mkdirSync('dist')
} catch (i) {
}

const name = 'dist/main.bundle.js'
const params = [name]

const handle = () => {
  const e = spawn(electron, params, {stdio: 'inherit'})
  e.on('close', function () {})
}

const hitServer = () => {
  var req = http.get('http://localhost:4000/dist/index.bundle.js', handle)
  req.on('error', e => {
    console.log('Error: ', e)
    console.log('Sleeping 5 seconds and retrying. Maybe start the hot-server?')
    setTimeout(() => hitServer(), 5000)
  })
}

hitServer()
