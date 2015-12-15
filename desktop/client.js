const http = require('http')
const fs = require('fs')
const spawn = require('child_process').spawn
const electron = require('electron-prebuilt')

try{
  fs.mkdirSync('dist')
} catch(i) {
}

const name = 'dist/main.hot.bundle.js'

const file = fs.createWriteStream(name)
http.get('http://localhost:4000/dist/main.bundle.js', function(response) {
  response.pipe(file)
  spawn(electron, [name, process.argv.slice(1)])
})
