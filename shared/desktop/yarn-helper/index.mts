// Helper for cross platform yarn run script commands
import buildCommands from './build.mts'
import electronComands from './electron.mts'
import fontCommands from './font.mts'
import {execSync} from 'child_process'
import path from 'path'
import fs from 'fs'
import {fileURLToPath} from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const [, , command, ...rest] = process.argv

type Command = {
  code?: (info: Command, exec: (...a: Array<any>) => void) => void
  help?: string
  env?: object
  shell?: string
  nodeEnv?: 'production' | 'development'
  options?: object
}

const commands: {[key: string]: Command} = {
  ...buildCommands,
  ...fontCommands,
  ...electronComands,
  help: {
    code: () => {
      const keys = Object.keys(commands) as Array<keyof typeof commands>
      console.log(
        keys
          .map(c => commands[c]?.help && `yarn run ${c}}${commands[c].help || ''}`)
          .filter(Boolean)
          .join('\n')
      )
    },
    help: '',
  },
  postinstall: {
    code: () => {
      syncLocalRNModules()
      checkFSEvents()
      clearTSCache()
      clearAndroidBuild()
      getMsgPack()
      patch()
    },
    help: '',
  },
  'sync-local-rnmodules': {
    code: () => {
      syncLocalRNModules()
    },
    help: 'Sync local file:../rnmodules dependencies into node_modules',
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

const checkFSEvents = () => {
  if (process.platform === 'darwin') {
    if (!fs.existsSync(path.resolve(__dirname, '..', '..', 'node_modules', 'fsevents'))) {
      console.log(
        `⚠️: You seem to be running OSX and don't have fsevents installed. This can make your hot server slow. Run 'yarn --check-files' once to fix this`
      )
    }
  }
}

const syncLocalRNModules = () => {
  const sharedRoot = path.resolve(__dirname, '..', '..')
  const repoRoot = path.resolve(sharedRoot, '..')
  const rnmodulesRoot = path.join(repoRoot, 'rnmodules')
  const nodeModulesRoot = path.join(sharedRoot, 'node_modules')

  if (!fs.existsSync(nodeModulesRoot)) {
    return
  }

  const packageJSONPath = path.join(sharedRoot, 'package.json')
  const packageJSON = JSON.parse(fs.readFileSync(packageJSONPath, 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    optionalDependencies?: Record<string, string>
  }
  const deps = {
    ...packageJSON.dependencies,
    ...packageJSON.devDependencies,
    ...packageJSON.optionalDependencies,
  }

  for (const [name, spec] of Object.entries(deps)) {
    if (!spec.startsWith('file:../rnmodules/')) {
      continue
    }

    const source = path.resolve(sharedRoot, spec.slice('file:'.length))
    const relToRNModules = path.relative(rnmodulesRoot, source)
    if (relToRNModules.startsWith('..') || path.isAbsolute(relToRNModules)) {
      continue
    }

    if (!fs.existsSync(source)) {
      throw new Error(`Local RN module source is missing for ${name}: ${source}`)
    }

    const dest = path.join(nodeModulesRoot, name)
    console.log(`Syncing ${name} from ${path.relative(sharedRoot, source)} to node_modules`)
    fs.rmSync(dest, {recursive: true, force: true})
    fs.mkdirSync(path.dirname(dest), {recursive: true})
    fs.cpSync(source, dest, {
      filter: src => {
        const rel = path.relative(source, src)
        return !(
          rel === 'node_modules' ||
          rel.startsWith(`node_modules${path.sep}`) ||
          rel === '.git' ||
          rel.startsWith(`.git${path.sep}`) ||
          rel === 'android/build' ||
          rel.startsWith(`android${path.sep}build${path.sep}`) ||
          rel === 'ios/build' ||
          rel.startsWith(`ios${path.sep}build${path.sep}`)
        )
      },
      recursive: true,
    })
  }
}

function exec(command: string, env?: object, options?: object) {
  console.log(
    execSync(command, {
      encoding: 'utf8',
      env: (env as typeof process.env | undefined) || process.env,
      stdio: 'inherit',
      ...options,
    })
  )
}

const decorateInfo = (info: Command) => {
  const temp = {
    ...info,
    env: {
      ...process.env,
      ...info.env,
    } as {NODE_ENV?: unknown},
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
    const ver = '7.0.0'
    const shasum = '37bbdbf69ef44392c7af215b9cb419891a9e1c9c'
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

const clearAndroidBuild = () => {
  const paths = ['../../android/build']
  for (const p of paths) {
    try {
      fs.rmSync(path.resolve(__dirname, p), {recursive: true, force: true})
    } catch {}
  }
}

const clearTSCache = () => {
  fs.rmSync(path.resolve(__dirname, '..', '..', '.tsOuts'), {recursive: true, force: true})
}

function main() {
  let info = commands[command ?? '']

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
