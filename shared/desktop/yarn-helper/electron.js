// @flow
import electron from 'electron'
import fs from 'fs'
import http from 'http'
import path from 'path'
import {spawn} from 'child_process'

const commands = {
  'inject-code-prod': {
    help: 'Copy current code into currently installed Keybase app',
    shell: 'yarn run package; cp dist/* /Applications/Keybase.app/Contents/Resources/app/desktop/dist/',
  },
  'inject-sourcemaps-prod': {
    help: '[Path to sourcemaps]: Copy sourcemaps into currently installed Keybase app',
    shell: "a(){ cp '$1'/* /Applications/Keybase.app/Contents/Resources/app/desktop/dist; };a",
  },
  start: {
    help: 'Do a simple dev build',
    shell: 'yarn run build-dev && yarn run start-cold',
  },
  'start-cold': {
    help: 'Start electron with no hot reloading',
    nodeEnv: 'development',
    shell: 'electron ./desktop/dist/main.bundle.js',
  },
  'start-hot': {
    code: startHot,
    env: {BABEL_ENV: 'yarn', HOT: 'true'},
    help: 'Start electron with hot reloading (needs yarn run hot-server)',
  },
  'start-prod': {
    help: 'Launch installed Keybase app with console output',
    shell: '/Applications/Keybase.app/Contents/MacOS/Electron',
  },
}

function startHot() {
  try {
    fs.mkdirSync(path.join(__dirname, 'dist'))
  } catch (i) {}

  const name = path.join(__dirname, 'dist', 'main.bundle.js')
  const params = [name]

  // Find extensions

  const devToolRoots = !process.env.KEYBASE_PERF && process.env.KEYBASE_DEV_TOOL_ROOTS
  const devToolExtensions = devToolRoots
    ? {
        KEYBASE_DEV_TOOL_EXTENSIONS: devToolRoots
          .split(',')
          .map(root => path.join(root, fs.readdirSync(root)[0]))
          .join(','),
      }
    : null

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
      const secs = 5
      console.log(`Sleeping ${secs} seconds and retrying. Maybe start the hot-server?`)
      setTimeout(hitServer, secs * 1000)
    })
  }

  hitServer()
}

export default commands
