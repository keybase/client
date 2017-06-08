// @flow
const http = require('http')
const fs = require('fs')
const spawn = require('child_process').spawn
const electron = require('electron')
const path = require('path')

try {
  fs.mkdirSync(path.join(__dirname, 'dist'))
} catch (i) {}

const name = path.join(__dirname, 'dist', 'main.bundle.js')
const params = [name]

// Find extensions

let devToolRoots = !process.env.KEYBASE_PERF && process.env.KEYBASE_DEV_TOOL_ROOTS
let devToolExtensions
if (devToolRoots) {
  devToolExtensions = {
    KEYBASE_DEV_TOOL_EXTENSIONS: devToolRoots
      .split(',')
      .map(root => path.join(root, fs.readdirSync(root)[0]))
      .join(','),
  }
}

const env = {
  ...process.env,
  ...devToolExtensions,
}

const hitServer = () => {
  var req = http.get('http://localhost:4000/dist/index.bundle.js', () => {
    spawn(electron, params, {env, stdio: 'inherit'})
  })
  req.on('error', e => {
    console.log('Error: ', e)
    console.log('Sleeping 5 seconds and retrying. Maybe start the hot-server?')
    setTimeout(() => hitServer(), 5000)
  })
}

hitServer()
