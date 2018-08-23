// @flow
// Helper for cross platform yarn run script commands
import buildCommands from './build'
import electronComands from './electron'
import fontCommands from './font'
import fs from 'fs'
import path from 'path'
import {execSync} from 'child_process'

const [, , command, ...rest] = process.argv

const commands = {
  ...buildCommands,
  ...fontCommands,
  ...electronComands,
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
      // Inject dummy modules
      makeShims(['net', 'tls', 'msgpack'])
      replaceShims(['babel-plugin-react-docgen']) // hopefully they fix this but short term to get storybook working just skip this plugin
    },
    help: 'all: install global eslint. dummy modules',
  },
}

function replaceShims(shims) {
  shims.forEach(shim => {
    console.log('Replacing module: ', shim)
    const root = path.resolve(__dirname, '..', '..', 'node_modules', shim)

    try {
      fs.writeFileSync(
        path.join(root, 'package.json'),
        `{
  "main": "index.js"
}
`
      )
    } catch (_) {}

    try {
      fs.writeFileSync(
        path.join(root, 'index.js'),
        `module.exports = function(){return {}} // Generated shim-module
`
      )
    } catch (_) {}
  })
}

function makeShims(shims) {
  shims.forEach(shim => {
    console.log('Shimming module: ', shim)
    const root = path.resolve(__dirname, '..', '..', 'node_modules', shim)

    try {
      fs.mkdirSync(root)
    } catch (_) {}

    try {
      fs.writeFileSync(
        path.join(root, 'package.json'),
        `{
  "main": "index.js"
}
`
      )
    } catch (_) {}

    try {
      fs.writeFileSync(
        path.join(root, 'index.js'),
        `module.exports = null // Generated shim-module
`
      )
    } catch (_) {}
  })
}

function exec(command, env, options) {
  console.log(execSync(command, {encoding: 'utf8', env: env || process.env, stdio: 'inherit', ...options}))
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
