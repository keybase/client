import path from 'path'
import {spawn, type ChildProcess} from 'child_process'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import type {ViteDevServer} from 'vite'

type WatchEvent =
  | {code: 'START' | 'END' | 'BUNDLE_START'}
  | {code: 'BUNDLE_END'; result?: {close: () => Promise<void>}}
  | {code: 'ERROR'; error: unknown}
type RollupWatcherLike = {
  on: (event: 'event', cb: (e: WatchEvent) => void) => void
  close: () => Promise<void>
}

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const isLinux = process.platform === 'linux'
const debugInNode = (false as boolean) ? '--inspect-brk' : ''
const remoteDebug = process.env['KB_ENABLE_REMOTE_DEBUG'] === '1' ? '--remote-debugging-port=9222' : ''
const devServerPort = 4000
const hotServerURL = `http://localhost:${devServerPort}`

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
  process.env['HOT'] = 'true'

  // Imported lazily: pulling vite in at module load would load its rolldown
  // native binding, which CI (jenkins_test.sh) skips via `yarn --ignore-optional`.
  // This module is imported by the postinstall helper, so an eager import breaks
  // `yarn install` on CI. Only the hot dev loop actually needs the bundler.
  const {createServer, build} = await import('vite')
  const {makeNodeConfig} = await import('../vite.node.mts')

  const watchers: Array<RollupWatcherLike> = []
  let electronProcess: ChildProcess | undefined
  let mainReady = false
  let restartingElectron = false
  let shuttingDown = false

  // Renderer: Vite ESM dev server with HMR. The main/remote windows load their
  // documents from this http origin (see html-root.desktop.tsx). Ready once
  // listen() resolves, so there is no separate rendererReady gate.
  const server: ViteDevServer = await createServer({mode: 'development'})
  await server.listen()
  console.log(`Renderer dev server ready at ${hotServerURL}`)

  const maybeLaunchElectron = () => {
    if (shuttingDown || !mainReady || electronProcess) {
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
    if (shuttingDown || !mainReady) {
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

  async function stop(code: number) {
    if (shuttingDown) {
      return
    }
    shuttingDown = true

    if (electronProcess) {
      electronProcess.kill()
      electronProcess = undefined
    }

    await Promise.all(watchers.map(async w => w.close().catch(() => {})))
    await server.close().catch(() => {})
    process.exit(code)
  }

  process.once('SIGINT', () => void stop(0))
  process.once('SIGTERM', () => void stop(0))

  // Main + preload: watch-mode node builds. Restart electron whenever either
  // rebuilds (renderer changes are hot-reloaded by Vite, no restart needed).
  const builtOnce = {node: false, preload: false}
  const makeHandler = (target: 'node' | 'preload') => (event: WatchEvent) => {
    if (event.code === 'ERROR') {
      console.error(`${target} build error`, event.error)
      return
    }
    if (event.code === 'BUNDLE_END') {
      void event.result?.close()
    }
    if (event.code !== 'END') {
      return
    }
    const wasBuilt = builtOnce[target]
    builtOnce[target] = true
    if (!builtOnce.node || !builtOnce.preload) {
      return
    }
    if (!mainReady) {
      mainReady = true
      console.log('Main/preload build complete')
      maybeLaunchElectron()
    } else if (wasBuilt) {
      restartElectron()
    }
  }

  for (const target of ['node', 'preload'] as const) {
    const watcher = (await build(
      makeNodeConfig(target, {isDev: true, isHot: true, isProfile: false, watch: true})
    )) as unknown as RollupWatcherLike
    watchers.push(watcher)
    watcher.on('event', makeHandler(target))
  }
}

export default commands
