import * as mockVm from 'vm'
import {askApp, filesSettings, setFolderSyncConfig} from './app-ask'

// jest's global (this project's types are mocha's and wdio's)
declare const jest: {mock: (path: string, factory: () => unknown) => void}

// A stand-in app: each eval body runs in one context holding a recorder and the app's modules, and
// the log keeps what the recorder and the service saw, in order.
const mockApp = {
  context: undefined as mockVm.Context | undefined,
  evalFails: false,
  log: [] as Array<string>,
}

jest.mock('../helpers/lifecycle', () => ({
  BUNDLE_ID: 'keybase.ios',
  deviceName: () => 'iPhoneTest',
  jsEval: async (body: string) => {
    if (mockApp.evalFails && body.includes('__kbE2EAppAsk = {ask')) throw new Error('the inspector page went away')
    return Promise.resolve(mockVm.runInContext(`(() => {${body}})()`, mockApp.context as mockVm.Context))
  },
  waitFor: async <R,>(_what: string, check: () => Promise<R | undefined>) => {
    for (let i = 0; i < 200; i++) {
      const r = await check()
      if (r !== undefined) return r
      await new Promise(resolve => setTimeout(resolve, 5))
    }
    throw new Error('timed out')
  },
}))

beforeEach(() => {
  mockApp.log = []
  mockApp.evalFails = false
  const log = (s: string) => mockApp.log.push(s)
  const rpc = {
    SimpleFSSimpleFSSetFolderSyncConfigRpcPromise: async (p: unknown) => {
      log(`set sync ${JSON.stringify(p)}`)
      return Promise.resolve()
    },
    SimpleFSSimpleFSSettingsRpcPromise: async () => {
      log('settings')
      return Promise.resolve({sfmiBannerDismissed: false, spaceAvailableNotificationThreshold: 3e9, syncOnCellular: true})
    },
  }
  const modules: Record<string, object> = {
    'constants/fs.tsx': {pathToRPCPath: (p: string) => ({PathType: 1, kbfs: {path: p.slice('/keybase'.length)}})},
    'constants/rpc/rpc-gen.tsx': rpc,
  }
  const kbModule = (name: string) => {
    const m = modules[name]
    if (!m) throw new Error(`no module ${name}`)
    return m
  }
  mockApp.context = mockVm.createContext({
    __kbE2ERecorder: {pause: () => {
      log('pause')
      return 'tok'
    }, resume: (t: string) => log(`resume ${t}`)},
    kbModule,
  })
  mockVm.runInContext('globalThis.globalThis = globalThis', mockApp.context)
})

test('an ask is answered with the recorder paused around it', async () => {
  await expect(filesSettings()).resolves.toEqual({spaceAvailableNotificationThreshold: 3e9, syncOnCellular: true})
  expect(mockApp.log).toEqual(['pause', 'settings', 'resume tok'])
})

test('the recorder is resumed when the body throws in the app, and the ask fails naming what it asked', async () => {
  await expect(askApp('the missing thing', `kbModule('nope').x()`)).rejects.toThrow("the missing thing: the phone's service answered no module nope")
  expect(mockApp.log).toEqual(['pause', 'resume tok'])
})

test('the recorder is resumed when the eval itself fails, and its error is the one thrown', async () => {
  mockApp.evalFails = true
  await expect(filesSettings()).rejects.toThrow('the inspector page went away')
  expect(mockApp.log).toEqual(['pause', 'resume tok'])
})

test('a restore sends the config it is given, and refuses a path that is not plain before any eval', async () => {
  await setFolderSyncConfig('/keybase/private/testuser,testuser-mac', {mode: 'enabled', paths: []})
  expect(mockApp.log).toEqual([
    'pause',
    'set sync {"config":{"mode":1,"paths":[]},"path":{"PathType":1,"kbfs":{"path":"/private/testuser,testuser-mac"}}}',
    'resume tok',
  ])
  mockApp.log = []
  await expect(setFolderSyncConfig('/keybase/private/x/../y', {mode: 'disabled', paths: []})).rejects.toThrow(/^refusing /)
  await expect(setFolderSyncConfig('/keybase/private/x', {mode: 'partial', paths: ['../y']})).rejects.toThrow(/^refusing /)
  expect(mockApp.log).toEqual([])
})
