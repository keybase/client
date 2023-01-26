// Helper for cross platform yarn run script commands
import buildCommands from './build'
import electronComands from './electron'
import fontCommands from './font'
import prettierCommands from './prettier'
import {execSync} from 'child_process'
import path from 'path'
import fs from 'fs'
import {rimrafSync} from 'rimraf'

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
      checkFSEvents()
      clearTSCache()
      clearAndroidBuild()
      getMsgPack()
      patch()
      patchIosKBLib()
      prepareSubmodules()
    },
    help: '',
  },
  test: {
    code: () => {
      const update = process.argv[3] === '-u'
      const updateLabel = update ? ' (updating storyshots)' : ''
      const updateStr = update ? ' -u Storyshots' : ''

      console.log(`Electron test${updateLabel}`)
      exec(`cross-env-shell BABEL_ENV=test jest${updateStr}`)
      console.log(`React Native test${updateLabel}`)
      exec(`cross-env-shell BABEL_ENV=test-rn jest --config .storybook-rn/jest.config.js${updateStr}`)
    },
    help: 'Run various tests. pass -u to update storyshots',
  },
}

const patch = () => {
  exec('patch-package')
}

const prepareSubmodules = () => {
  if (process.platform === 'darwin') {
    const root = path.resolve(__dirname, '..', '..', '..', 'rnmodules')
    const tsOverride = path.resolve(__dirname, '..', '..', 'override-d.ts')
    fs.readdirSync(root, {withFileTypes: true}).forEach(f => {
      if (f.isDirectory()) {
        const full = path.resolve(root, f.name)
        exec(`cd ${full} && yarn`)
        // need top bring our TS over, hacky but other things were more complex
        exec(`cp ${full}/lib/typescript/index.d.ts ${tsOverride}/${f.name}`)
      }
    })
  }
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

function fixModules() {
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

function exec(command: string, env?: any, options?: Object) {
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
  const temp = {
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

const getMsgPack = () => {
  if (process.platform === 'darwin') {
    const ver = '4.1.1'
    const shasum = '3b64e37641520ea0c9d1f52f80de61ea1868b42c'
    const file = `msgpack-cxx-${ver}.tar.gz`
    const url = `https://github.com/msgpack/msgpack-c/releases/download/cpp-${ver}/${file}`
    const prefix = path.resolve(__dirname, '..', '..', 'node_modules')
    const dlpath = path.resolve(prefix, '.cache')
    const shacheckcmd = `echo '${shasum} *.cache/${file}' | shasum -c`
    const checkAndUntar = `cd node_modules ; ${shacheckcmd} && tar -xf .cache/${file}`
    const downloadMP = `curl -L -o ${dlpath}/${file} ${url}`

    try {
      fs.mkdirSync(dlpath)
    } catch {}
    if (!fs.existsSync(path.resolve(dlpath, file))) {
      console.log('Missing msgpack-cpp, downloading')
      exec(downloadMP)
    }
    if (!fs.existsSync(path.resolve(prefix, file))) {
      try {
        exec(checkAndUntar)
      } catch {
        console.log('untar failed, deleting, try building again. trying one more time')
        exec(`cd node_modules ; rm .cache/${file}`)
        exec(downloadMP)
        exec(checkAndUntar)
      }
    }
  }
}

const patchIosKBLib = () => {
  if (process.platform === 'darwin') {
    const prefixes = [
      'ios/keybase.xcframework/ios-arm64',
      'ios/keybase.xcframework/ios-arm64_x86_64-simulator',
    ]
    const files = ['Keybase.objc.h', 'Universe.objc.h']
    for (const prefix of prefixes) {
      for (const file of files) {
        const path = `${prefix}/Keybase.framework/Versions/Current/Headers/${file}`
        try {
          console.log('Patching go libs', path)
          exec(`sed -i -e 's/@import Foundation;/#include <Foundation\\/Foundation.h>/' ${path}`)
        } catch {
          console.log('Patching skipped')
        }
      }
    }
  }
}

const clearAndroidBuild = () => {
  const paths = [
    '../../android/build',
    '../../../rnmodules/react-native-kb/android/build',
    '../../../rnmodules/react-native-kb/android/.cxx',
    '../../../rnmodules/react-native-drop-view/android/build',
  ]
  for (const p of paths) {
    try {
      rimrafSync(path.resolve(__dirname, p))
    } catch {}
  }
}

const clearTSCache = () => {
  rimrafSync(path.resolve(__dirname, '..', '..', '.tsOuts'))
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
