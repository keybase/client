import * as mockVm from 'vm'
import {
  archiveJobs,
  askApp,
  compressPreference,
  filesSettings,
  guiClearValue,
  guiSetValue,
  guiValue,
  proxyData,
  randomPW,
  rememberPassphrase,
  removeArchiveJobs,
  runtimeStats,
  setCompressPreference,
  setDebugLevel,
  setFilesSettings,
  setFolderSyncConfig,
  setProxyData,
  setRememberPassphrase,
  toggleRuntimeStats,
} from './app-ask'

// jest's global (this project's types are mocha's and wdio's)
declare const jest: {mock: (path: string, factory: () => unknown) => void}

// A stand-in app: each eval body runs in one context holding a recorder and the app's modules, and
// the log keeps what the recorder and the service saw, in order.
const mockApp = {
  context: undefined as mockVm.Context | undefined,
  evalFails: false,
  // the next RPC fails with this
  failNext: '',
  // set: the threshold call answers only once it is called
  holdThreshold: undefined as undefined | {release?: () => void},
  log: [] as Array<string>,
  stats: undefined as undefined | object,
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
  mockApp.holdThreshold = undefined
  mockApp.failNext = ''
  mockApp.stats = undefined
  const log = (s: string) => mockApp.log.push(s)
  const rpc: Record<string, unknown> = {
    SimpleFSSimpleFSSetFolderSyncConfigRpcPromise: async (p: unknown) => {
      log(`set sync ${JSON.stringify(p)}`)
      return Promise.resolve()
    },
    SimpleFSSimpleFSSetNotificationThresholdRpcPromise: async (p: {threshold: number}) => {
      log(`threshold ${p.threshold}`)
      const hold = mockApp.holdThreshold
      return hold ? new Promise<void>(resolve => (hold.release = resolve)) : Promise.resolve()
    },
    SimpleFSSimpleFSSetSyncOnCellularRpcPromise: async (p: {syncOnCellular: boolean}) => {
      log(`cellular ${p.syncOnCellular}`)
      return Promise.resolve()
    },
    SimpleFSSimpleFSSettingsRpcPromise: async () => {
      log('settings')
      return Promise.resolve({sfmiBannerDismissed: false, spaceAvailableNotificationThreshold: 3e9, syncOnCellular: true})
    },
  }
  const answer = async (line: string, value?: unknown) => {
    log(line)
    if (mockApp.failNext) {
      const why = mockApp.failNext
      mockApp.failNext = ''
      return Promise.reject(new Error(why))
    }
    return Promise.resolve(value)
  }
  Object.assign(rpc, {
    IncomingShareCompressPreference: {compressed: 1, original: 0},
    PassphraseState: {known: 0, random: 1},
    SimpleFSSimpleFSArchiveCancelOrDismissJobRpcPromise: async (p: {jobID: string}) => answer(`kbfs cancel ${p.jobID}`),
    SimpleFSSimpleFSGetArchiveStatusRpcPromise: async () => answer('kbfs list', {jobs: [{desc: {jobID: 'k1'}}, {desc: {jobID: 'k2'}}]}),
    SimpleFSSimpleFSSetDebugLevelRpcPromise: async (p: {level: string}) => answer(`debug ${p.level}`),
    TLFIdentifyBehavior: {unset: 0},
    configGetProxyDataRpcPromise: async () => answer('get proxy', {addressWithPort: 'localhost:8080', certPinning: true, proxyType: 1}),
    configGetRememberPassphraseRpcPromise: async () => answer('get remember', true),
    configGuiGetValueRpcPromise: async (p: {path: string}) =>
      answer(`gui get ${p.path}`, p.path === 'ui.darkMode' ? {isNull: false, s: 'alwaysLight'} : undefined).then(v =>
        v ? v : Promise.reject(new Error('no such key'))
      ),
    configGuiSetValueRpcPromise: async (p: {path: string; value: unknown}) => answer(`gui set ${p.path} ${JSON.stringify(p.value)}`),
    configSetProxyDataRpcPromise: async (p: {proxyData: unknown}) => answer(`set proxy ${JSON.stringify(p.proxyData)}`),
    configSetRememberPassphraseRpcPromise: async (p: {remember: boolean}) => answer(`set remember ${p.remember}`),
    configToggleRuntimeStatsRpcPromise: async () => answer('toggle stats'),
    incomingShareGetPreferenceRpcPromise: async () => answer('get compress', {compressPreference: 0}),
    incomingShareSetPreferenceRpcPromise: async (p: {preference: {compressPreference: number}}) =>
      answer(`set compress ${p.preference.compressPreference}`),
    userLoadPassphraseStateRpcPromise: async () => answer('passphrase state', 0),
  })
  const chat = {
    localArchiveChatDeleteRpcPromise: async (p: {jobID: string; deleteOutputPath: boolean}) => answer(`chat delete ${p.jobID} ${p.deleteOutputPath}`),
    localArchiveChatListRpcPromise: async () => answer('chat list', {jobs: [{request: {jobID: 'c1'}}]}),
  }
  const callPort = {
    getCallPort: () => ({
      call: (p: {method: string; params: {path: string}; callback: (e?: Error) => void}) => {
        log(`call ${p.method} ${p.params.path}`)
        p.callback()
        return 1
      },
    }),
  }
  const modules: Record<string, object> = {
    'constants/fs.tsx': {pathToRPCPath: (p: string) => ({PathType: 1, kbfs: {path: p.slice('/keybase'.length)}})},
    'constants/rpc/rpc-chat-gen.tsx': chat,
    'constants/rpc/rpc-gen.tsx': rpc,
    'engine/call-port.tsx': callPort,
    'stores/config.tsx': {useConfigState: {getState: () => ({runtimeStats: mockApp.stats})}},
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

test("a failed ask names the test accounts by role, never by name", async () => {
  const saved = {...process.env}
  Object.assign(process.env, {KB_E2E_TEAM: 'testteam', KB_SECOND_USER: 'testuser-mac', KB_SMOKE_USER: 'testuser'})
  try {
    await expect(
      askApp('the sync config', `(() => { throw new Error('no folder /keybase/private/testuser,testuser-mac') })()`)
    ).rejects.toThrow("the sync config: the phone's service answered no folder /keybase/private/<smoke>,<second>")
  } finally {
    process.env = saved
  }
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

test('a restore of two calls sends both while the ask is waited on', async () => {
  await setFilesSettings({spaceAvailableNotificationThreshold: 1e9, syncOnCellular: false})
  expect(mockApp.log).toEqual(['pause', 'threshold 1000000000', 'cellular false', 'resume tok'])
})

test('a restore whose first call answers after the ask timed out never sends its second', async () => {
  mockApp.holdThreshold = {}
  await expect(setFilesSettings({spaceAvailableNotificationThreshold: 1e9, syncOnCellular: false})).rejects.toThrow('timed out')
  expect(mockApp.log).toEqual(['pause', 'threshold 1000000000', 'resume tok'])
  mockApp.holdThreshold.release?.()
  await new Promise(resolve => setTimeout(resolve, 50))
  expect(mockApp.log).toEqual(['pause', 'threshold 1000000000', 'resume tok'])
  const left = mockVm.runInContext('globalThis.__kbE2EAppAsk', mockApp.context as mockVm.Context) as {ask: string; state: string}
  expect(left).toEqual({ask: '', state: 'given up'})
})

describe("the phone's local settings", () => {
  test('each read is answered with the recorder paused around it', async () => {
    await expect(rememberPassphrase()).resolves.toBe(true)
    await expect(proxyData()).resolves.toEqual({addressWithPort: 'localhost:8080', certPinning: true, proxyType: 1})
    await expect(guiValue('ui.darkMode')).resolves.toEqual({isNull: false, s: 'alwaysLight'})
    await expect(compressPreference()).resolves.toBe('original')
    await expect(randomPW()).resolves.toBe(false)
    await expect(runtimeStats()).resolves.toBe(false)
    mockApp.stats = {cpu: 1}
    await expect(runtimeStats()).resolves.toBe(true)
    expect(mockApp.log).toEqual([
      ...['get remember', 'get proxy', 'gui get ui.darkMode', 'get compress', 'passphrase state'].flatMap(l => ['pause', l, 'resume tok']),
      ...['pause', 'resume tok', 'pause', 'resume tok'],
    ])
  })

  test('a GUI config key that is not set reads as undefined, not as a failure', async () => {
    await expect(guiValue('ui.forceSmallNav')).resolves.toBeUndefined()
  })

  test('each restore sends what it is given', async () => {
    await setRememberPassphrase(false)
    await setProxyData({addressWithPort: '', certPinning: true, proxyType: 0})
    await guiSetValue('ui.darkMode', {isNull: false, s: 'system'})
    await guiClearValue('ui.darkMode')
    await setCompressPreference('compressed')
    await setDebugLevel('vlog1')
    await toggleRuntimeStats()
    expect(mockApp.log.filter(l => l !== 'pause' && l !== 'resume tok')).toEqual([
      'set remember false',
      'set proxy {"addressWithPort":"","certPinning":true,"proxyType":0}',
      'gui set ui.darkMode {"isNull":false,"s":"system"}',
      'call keybase.1.config.guiClearValue ui.darkMode',
      'set compress 1',
      'debug vlog1',
      'toggle stats',
    ])
  })

  test('a restore of a value that is not plain is refused before any eval', async () => {
    for (const f of [
      async () => setProxyData({addressWithPort: 'a b`', certPinning: true, proxyType: 0}),
      async () => setProxyData({addressWithPort: '', certPinning: true, proxyType: 7 as 0}),
      async () => guiSetValue('ui.dark`Mode', {isNull: false, s: 'system'}),
      async () => guiSetValue('ui.darkMode', {isNull: false, s: 'sys`tem'}),
      async () => guiClearValue('../x'),
      async () => setDebugLevel('v 1'),
    ]) {
      await expect(f()).rejects.toThrow(/^refusing /)
    }
    expect(mockApp.log).toEqual([])
  })

  test('a body that throws in the app resumes the recorder and names what it asked', async () => {
    mockApp.failNext = 'the service is gone'
    await expect(rememberPassphrase()).rejects.toThrow("the phone's remember-password setting: the phone's service answered the service is gone")
    expect(mockApp.log).toEqual(['pause', 'get remember', 'resume tok'])
  })
})

describe('backup jobs', () => {
  test("lists the phone's chat and files jobs", async () => {
    await expect(archiveJobs()).resolves.toEqual({chat: ['c1'], kbfs: ['k1', 'k2']})
    expect(mockApp.log).toEqual(['pause', 'chat list', 'kbfs list', 'resume tok'])
  })

  test('removes the jobs the flow made, deleting the chat output too', async () => {
    await removeArchiveJobs({chat: ['c9'], kbfs: ['k9']}, {chat: ['c1'], kbfs: ['k1']})
    expect(mockApp.log).toEqual(['pause', 'chat delete c9 true', 'kbfs cancel k9', 'resume tok'])
  })

  test('refuses a job that was there before the flow, naming none, before any eval', async () => {
    for (const ids of [
      {chat: ['c1'], kbfs: []},
      {chat: [], kbfs: ['k9', 'k1']},
    ]) {
      const err = await removeArchiveJobs(ids, {chat: ['c1'], kbfs: ['k1']}).catch((e: unknown) => e as Error)
      expect(String(err)).toMatch(/refusing /)
      expect(String(err)).not.toMatch(/c1|k1|k9/)
    }
    await expect(removeArchiveJobs({chat: ['c`'], kbfs: []}, {chat: [], kbfs: []})).rejects.toThrow(/^refusing /)
    expect(mockApp.log).toEqual([])
  })

  test('removing no jobs asks nothing', async () => {
    await removeArchiveJobs({chat: [], kbfs: []}, {chat: ['c1'], kbfs: []})
    expect(mockApp.log).toEqual([])
  })

  test('a failed delete stops the chain: the next job is never sent, and the recorder is resumed', async () => {
    mockApp.failNext = 'no such job'
    await expect(removeArchiveJobs({chat: ['c8', 'c9'], kbfs: []}, {chat: [], kbfs: []})).rejects.toThrow(/no such job/)
    expect(mockApp.log).toEqual(['pause', 'chat delete c8 true', 'resume tok'])
  })
})
