// @flow
const http = require('http')
const fs = require('fs')
const spawn = require('child_process').spawn
const electron = require('electron-prebuilt')

try {
  fs.mkdirSync('dist')
} catch (i) {
}

const name = 'dist/main.hot.bundle.js'
const file = fs.createWriteStream(name)

const handle = (response) => {
  response.pipe(file)
  file.on('finish', function () {
    file.close(function () {
      const params = [name]

      if (process.env.USE_INSPECTOR) {
        params.unshift('--debug-brk=5858')
      }

      const e = spawn(electron, params, {stdio: 'inherit'})
      e.on('close', function () {})
    })
  })
}

const hitServer = () => {
  var req = http.get('http://localhost:4000/dist/main.bundle.js', handle)
  req.on('error', e => {
    console.log('Error: ', e)
    console.log('Sleeping 5 seconds and retrying. Maybe start the hot-server?')
    setTimeout(() => hitServer(), 5000)
  })
}

hitServer()
