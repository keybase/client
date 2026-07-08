import path from 'path'
import {spawn, type ChildProcess} from 'child_process'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import {rspack} from '@rspack/core'
import {RspackDevServer} from '@rspack/dev-server'
import type {Configuration, MultiStats, Stats} from '@rspack/core'
import rootConfig from '../webpack.config.mts'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const isLinux = process.platform === 'linux'
const debugInNode = (false as boolean) ? '--inspect-brk' : ''
const remoteDebug = process.env['KB_ENABLE_REMOTE_DEBUG'] === '1' ? '--remote-debugging-port=9222' : ''
const hotServerURL = 'http://localhost:4000'

type RendererConfig = Configuration & {
  devServer?: ConstructorParameters<typeof RspackDevServer>[0]
}

const commands = {
  profile: {
    env: {PROFILE: 'true'},
    help: 'Start electron with profiling react',
    shell: 'yarn run desktop:build:profile && yarn run desktop:start:profile',
  },
  start: {
    help: 'Do a simple dev build',
    shell: 'yarn run desktop:build:dev && yarn run desktop:start:cold',
  },
  'start:cold': {
    help: 'Start electron with no hot reloading',
    nodeEnv: 'development',
    shell: `electron ${debugInNode} ${path.resolve(__dirname, '../dist/node.dev.bundle.js')}`,
  },
  'start:hot': {
    code: startHot,
    env: {HOT: 'true'},
    help: 'Start electron with renderer HMR and restart on main/preload changes',
  },
  'start:prod': {
    help: 'Launch installed Keybase app with console output',
    shell: '/Applications/Keybase.app/Contents/MacOS/Electron',
  },
  'start:profile': {
    help: 'Start electron with profile',
    shell: `electron ${path.resolve(__dirname, '../dist/node.profile.bundle.js')}`,
  },
} as const

function findConfig(configs: Array<Configuration>, name: string): Configuration {
  const config = configs.find(c => c.name === name)
  if (!config) {
    throw new Error(`Missing webpack config: ${name}`)
  }
  return config
}

function statsOutput(stats: Stats | MultiStats) {
  return stats.toString({
    assets: false,
    chunks: false,
    colors: true,
    entrypoints: false,
    modules: false,
  })
}

function startElectron(): ChildProcess {
  const electron = require('electron') as unknown as string
  const appEntry = path.join(__dirname, '..', 'dist', 'node.dev.bundle.js')
  const args = [
    ...(debugInNode ? [debugInNode] : []),
    ...(remoteDebug ? [remoteDebug] : []),
    ...(isLinux ? ['--disable-gpu'] : []),
    appEntry,
  ]

  return spawn(electron, args, {
    env: {...process.env, HOT: 'true', NODE_ENV: 'development'},
    stdio: 'inherit',
  })
}

function startHot() {
  void startHotLoop().catch(error => {
    console.error(error)
    process.exit(1)
  })
}

async function startHotLoop() {
  const prevHot = process.env['HOT']
  process.env['HOT'] = 'true'
  const configs = rootConfig(null, {mode: 'development'})
  if (prevHot === undefined) {
    delete process.env['HOT']
  } else {
    process.env['HOT'] = prevHot
  }
  const nodeConfig = findConfig(configs, 'node')
  const preloadConfig = findConfig(configs, 'preload')
  const rendererConfig = findConfig(configs, 'renderer') as RendererConfig
  const {devServer, ...rendererWebpackConfig} = rendererConfig

  if (!devServer) {
    throw new Error('Missing devServer options for renderer config')
  }

  const rendererCompiler = rspack(rendererWebpackConfig)
  const mainCompiler = rspack([nodeConfig, preloadConfig])

  let electronProcess: ChildProcess | undefined
  let mainReady = false
  let rendererReady = false
  let restartingElectron = false
  let shuttingDown = false

  const maybeLaunchElectron = () => {
    if (shuttingDown || !mainReady || !rendererReady || electronProcess) {
      return
    }

    console.log('Launching Electron')
    electronProcess = startElectron()
    electronProcess.once('exit', code => {
      electronProcess = undefined
      if (restartingElectron || shuttingDown) {
        restartingElectron = false
        if (!shuttingDown) {
          maybeLaunchElectron()
        }
        return
      }
      void stop(code ?? 0)
    })
  }

  const restartElectron = () => {
    if (shuttingDown || !mainReady || !rendererReady) {
      return
    }
    if (!electronProcess) {
      maybeLaunchElectron()
      return
    }

    console.log('Restarting Electron after main/preload rebuild')
    restartingElectron = true
    electronProcess.kill()
  }

  rendererCompiler.hooks.done.tap('desktop-hot-renderer', (stats: Stats) => {
    if (stats.hasErrors()) {
      console.log(statsOutput(stats))
      return
    }

    if (!rendererReady) {
      console.log(`Renderer dev server ready at ${hotServerURL}`)
    }
    rendererReady = true
    maybeLaunchElectron()
  })

  const server = new RspackDevServer(devServer, rendererCompiler)

  const watching = mainCompiler.watch({}, (error: Error | null, stats?: MultiStats) => {
    if (error) {
      console.error(error)
      return
    }
    if (!stats) {
      return
    }
    if (stats.hasErrors()) {
      console.log(statsOutput(stats))
      return
    }

    console.log('Main/preload build complete')
    mainReady = true
    if (electronProcess) {
      restartElectron()
      return
    }
    maybeLaunchElectron()
  })

  process.once('SIGINT', () => {
    void stop(0)
  })
  process.once('SIGTERM', () => {
    void stop(0)
  })

  async function stop(code: number) {
    if (shuttingDown) {
      return
    }
    shuttingDown = true

    if (electronProcess) {
      electronProcess.kill()
      electronProcess = undefined
    }

    await new Promise<void>(resolve => watching.close(() => resolve()))

    await server.stop().catch(() => {})
    process.exit(code)
  }

  try {
    await server.start()
  } catch (error) {
    console.error(error)
    await stop(1)
  }
}

export default commands
