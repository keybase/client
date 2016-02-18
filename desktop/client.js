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
http.get('http://localhost:4000/dist/main.bundle.js', function (response) {
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
})
