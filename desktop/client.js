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
  const e = spawn(electron, [name])
  e.stdout.on('data', function (data) {
    console.log(data.toString())
  })

  e.stderr.on('data', function (data) {
    console.log('E: ' + data)
  })
})
