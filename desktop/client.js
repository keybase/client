const fs = require('fs')
const spawn = require('child_process').spawn
const electron = require('electron-prebuilt')

try {
  fs.mkdirSync('dist')
} catch (i) {
}

const name = 'dist/main.bundle.js'
const params = [name]

if (process.env.USE_INSPECTOR) {
  params.unshift('--debug-brk=5858')
}

const e = spawn(electron, params, {stdio: 'inherit'})
e.on('close', function () {})
