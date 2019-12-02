// Helper for cross platform yarn run script commands
import buildCommands from './build'
import electronComands from './electron'
import fontCommands from './font'
import prettierCommands from './prettier'
import {execSync} from 'child_process'
import path from 'path'
import fs from 'fs'
import rimraf from 'rimraf'
import patcher from './patcher'

const [, , command, ...rest] = process.argv

const commands = {
  ...buildCommands,
  ...fontCommands,
  ...electronComands,
  ...prettierCommands,
  help: {
    code: () => {
      console.log(
        Object.keys(commands)
          .map(c => commands[c].help && `yarn run ${c}}${commands[c].help || ''}`)
          .filter(Boolean)
          .join('\n')
      )
    },
  },
  postinstall: {
    code: () => {
      fixModules()
      fixTypes()
      checkFSEvents()
      clearTSCache()
      patcher()
    },
    help: '',
  },
}

const checkFSEvents = () => {
  if (process.platform === 'darwin') {
    if (!fs.existsSync(path.resolve(__dirname, '..', '..', 'node_modules', 'fsevents'))) {
      console.log(
        `⚠️: You seem to be running OSX and don't have fsevents installed. This can make your hot server slow. Run 'yarn --check-files' once to fix this`
      )
    }
  }
}

const fixTypes = () => {
  // couldn't figure out an effective way to patch this file up, so just blowing it away
  const files = ['@types/react-native/index.d.ts']

  files.forEach(file => {
    const p = path.resolve(__dirname, '..', '..', 'node_modules', file)
    try {
      fs.unlinkSync(p)
    } catch (_) {}
  })

  try {
    fs.copyFileSync(
      path.resolve(__dirname, '..', '..', 'override-d.ts', 'react-native', 'kb-custom'),
      path.resolve(__dirname, '..', '..', 'node_modules', '@types', 'react-native', 'index.d.ts')
    )
  } catch (_) {}
}

const fixUnimodules = () => {
  const root = path.resolve(
    __dirname,
    '..',
    '..',
    'node_modules',
    '@unimodules',
    'react-native-adapter',
    'android'
  )
  try {
    const buildGradle = fs.readFileSync(path.resolve(__dirname, 'unimodules-build-gradle'), {
      encoding: 'utf8',
    })
    fs.writeFileSync(path.join(root, 'build.gradle'), buildGradle)
  } catch (_) {}
}

function fixModules() {
  if (process.platform !== 'win32') {
    fixUnimodules()
    // run jetify to fix android deps
    exec('yarn jetify', null, null)
  }

  // storybook uses react-docgen which really cr*ps itself with flow
  // I couldn't find a good way to override this effectively (yarn resolutions didn't work) so we're just killing it with fire
  const root = path.resolve(__dirname, '..', '..', 'node_modules', 'babel-plugin-react-docgen')

  try {
    fs.mkdirSync(root)
  } catch (_) {}

  try {
    fs.writeFileSync(path.join(root, 'package.json'), `{"main": "index.js"}`)
    fs.writeFileSync(path.join(root, 'index.js'), `module.exports = function(){return {};};`)
  } catch (_) {}
}

function exec(command, env, options) {
  console.log(
    execSync(command, {
      encoding: 'utf8',
      env: env || process.env,
      stdio: 'inherit',
      ...options,
    })
  )
}

const decorateInfo = info => {
  let temp = {
    ...info,
    env: {
      ...process.env,
      ...info.env,
    },
  }

  if (info.nodeEnv) {
    temp.env.NODE_ENV = info.nodeEnv
  }

  if (rest.length && temp.shell) {
    temp.shell = `${temp.shell} ${rest.join(' ')}`
  }

  return temp
}

const warnFail = err => err && console.warn(`Error cleaning tscache ${err}, tsc may be inaccurate.`)
const clearTSCache = () => {
  const glob = path.resolve(__dirname, '..', '..', '.tsOuts', '.tsOut*')
  rimraf(glob, {}, warnFail)
}

function main() {
  let info = commands[command]

  if (!info) {
    console.log('Unknown command: ', command)
    process.exit(1)
  }

  info = decorateInfo(info)

  if (info.shell) {
    exec(info.shell, info.env, info.options)
  }

  if (info.code) {
    info.code(info, exec)
  }
}

main()
