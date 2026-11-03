import * as mockVm from 'vm'
import {
  archiveJobIDs,
  archiveJobStates,
  askApp,
  compressPreference,
  darkModeState,
  deleteSavedAsset,
  filesSettings,
  guiClearValue,
  guiSetValue,
  guiValue,
  assetInfo,
  libraryAssetIds,
  libraryHasAsset,
  mediaPermission,
  phoneDownloads,
  requestFullPhotoAccess,
  proxyData,
  randomPW,
  phoneReachesServer,
  rememberPassphrase,
  removeArchiveJobs,
  runtimeStatsEnabled,
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
  // the phone's photo library
  assets: [] as Array<{height: number; id: string; mediaType: string; width: number}>,
  // the phone service's downloads
  downloads: [] as Array<{canceled: boolean; done: boolean; downloadID: string}>,
  // the service config's runtime stats flag; undefined: never set
  statsEnabled: undefined as undefined | boolean,
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
  mockApp.statsEnabled = undefined
  mockApp.assets = []
  mockApp.downloads = []
  const log = (s: string) => mockApp.log.push(s)
  const rpc: Record<string, unknown> = {
    SimpleFSSimpleFSGetDownloadStatusRpcPromise: async () => answer('download status', {regularDownloadIDs: null, states: mockApp.downloads}),
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
    SimpleFSSimpleFSGetArchiveStatusRpcPromise: async () =>
      answer('kbfs list', {
        jobs: [
          {desc: {jobID: 'k1', stagingPath: '/c/s1', zipFilePath: '/c/s1/a.zip'}, phase: 3},
          {desc: {jobID: 'k2', stagingPath: '/c/s2', zipFilePath: '/c/s2/b.zip'}, phase: 6},
        ],
      }),
    SimpleFSSimpleFSSetDebugLevelRpcPromise: async (p: {level: string}) => answer(`debug ${p.level}`),
    TLFIdentifyBehavior: {unset: 0},
    apiserverGetWithSessionRpcPromise: async (p: {endpoint: string}) => answer(`get ${p.endpoint}`, {body: '{"status":{"code":0}}'}),
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
    localArchiveChatListRpcPromise: async () => answer('chat list', {jobs: [{request: {jobID: 'c1', outputPath: '/c/o1'}, status: 1}]}),
  }
  const callPort = {
    getCallPort: () => ({
      call: (p: {method: string; params: {path: string}; callback: (e?: Error, v?: unknown) => void}) => {
        log(`call ${p.method} ${p.params.path}`)
        if (p.method !== 'keybase.1.config.getValue') p.callback()
        else if (mockApp.statsEnabled === undefined) p.callback(new Error(`no such key: ${p.params.path}`))
        else p.callback(undefined, {b: mockApp.statsEnabled, isNull: false})
        return 1
      },
    }),
  }
  const modules: Record<string, object> = {
    'constants/fs.tsx': {pathToRPCPath: (p: string) => ({PathType: 1, kbfs: {path: p.slice('/keybase'.length)}})},
    'constants/rpc/rpc-chat-gen.tsx': chat,
    'constants/rpc/rpc-gen.tsx': rpc,
    'engine/call-port.tsx': callPort,
    'node_modules/expo-media-library/build/index.js': {
      Asset: class {
        constructor(readonly id: string) {}
        private find() {
          const a = mockApp.assets.find(x => x.id === this.id)
          if (!a) throw new Error('no such asset')
          return a
        }
        async getInfo() {
          const a = this.find()
          return answer(`asset info ${a.id}`, {filename: 'IMG_1.PNG', height: a.height, id: a.id, mediaType: a.mediaType, width: a.width})
        }
        async delete() {
          const a = this.find()
          mockApp.assets = mockApp.assets.filter(x => x !== a)
          return answer(`delete asset ${a.id}`)
        }
      },
      Query: class {
        async exe() {
          log('assets all')
          return Promise.resolve(mockApp.assets.map(a => ({id: a.id})))
        }
      },
      requestPermissionsAsync: async (writeOnly?: boolean) =>
        answer(`media permission request ${writeOnly ? 'add' : 'read'}`, {accessPrivileges: 'all', granted: true, status: 'granted'}),
      getPermissionsAsync: async (writeOnly?: boolean) =>
        answer(`media permission ${writeOnly ? 'add' : 'read'}`, writeOnly ? {status: 'granted'} : {accessPrivileges: 'none', status: 'denied'}),
    },
    'stores/darkmode.tsx': {
      useDarkModeState: {getState: () => ({darkModePreference: 'alwaysLight', supported: true, systemDarkMode: false})},
    },
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
    expect(mockApp.log).toEqual(
      ['get remember', 'get proxy', 'gui get ui.darkMode', 'get compress', 'passphrase state'].flatMap(l => ['pause', l, 'resume tok'])
    )
  })

  test("the runtime stats flag, the server read and the theme state are each answered with the recorder paused", async () => {
    await expect(runtimeStatsEnabled()).resolves.toBe(false)
    mockApp.statsEnabled = true
    await expect(runtimeStatsEnabled()).resolves.toBe(true)
    mockApp.statsEnabled = false
    await expect(runtimeStatsEnabled()).resolves.toBe(false)
    await expect(phoneReachesServer()).resolves.toBe(true)
    await expect(darkModeState()).resolves.toEqual({preference: 'alwaysLight', supported: true, systemDark: false})
    expect(mockApp.log).toEqual([
      ...Array.from({length: 3}, () => ['pause', 'call keybase.1.config.getValue runtime_stats_enabled', 'resume tok']).flat(),
      ...['pause', 'get account/subscriptions', 'resume tok'],
      ...['pause', 'resume tok'],
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
    await setDebugLevel('vlog1,dump-payload')
    await toggleRuntimeStats()
    expect(mockApp.log.filter(l => l !== 'pause' && l !== 'resume tok')).toEqual([
      'set remember false',
      'set proxy {"addressWithPort":"","certPinning":true,"proxyType":0}',
      'gui set ui.darkMode {"isNull":false,"s":"system"}',
      'call keybase.1.config.guiClearValue ui.darkMode',
      'set compress 1',
      'debug vlog1',
      'debug vlog1,dump-payload',
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
      async () => setDebugLevel('vlog1,vlog9'),
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
  test("lists the phone's chat and files jobs by id", async () => {
    expect(archiveJobIDs(await archiveJobStates())).toEqual({chat: ['c1'], kbfs: ['k1', 'k2']})
    expect(mockApp.log).toEqual(['pause', 'chat list', 'kbfs list', 'resume tok'])
  })

  test("lists the phone's jobs with their states and paths", async () => {
    await expect(archiveJobStates()).resolves.toEqual({
      chat: [{id: 'c1', outputPath: '/c/o1', status: 1}],
      kbfs: [
        {id: 'k1', phase: 3, stagingPath: '/c/s1', zipFilePath: '/c/s1/a.zip'},
        {id: 'k2', phase: 6, stagingPath: '/c/s2', zipFilePath: '/c/s2/b.zip'},
      ],
    })
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

const ID = 'ph://0F4B5C3D-1A2B-4C5D-8E9F-0123456789AB/L0/001'
const OTHER = '1F4B5C3D-1A2B-4C5D-8E9F-0123456789AB/L0/001'

describe('native permissions and the photo library', () => {
  test('the photo permission is read as the app sees it, with the recorder paused', async () => {
    await expect(mediaPermission()).resolves.toEqual({add: 'granted', read: 'denied', readAccess: 'none'})
    expect(mockApp.log).toEqual(['pause', 'media permission read', 'media permission add', 'resume tok'])
  })

  test("the library's asset ids, and an asset's kind and size", async () => {
    await expect(libraryAssetIds()).resolves.toEqual([])
    mockApp.assets = [{height: 48, id: ID, mediaType: 'image', width: 64}]
    await expect(libraryAssetIds()).resolves.toEqual([ID])
    await expect(assetInfo(ID)).resolves.toEqual({height: 48, mediaType: 'image', width: 64})
    await expect(assetInfo(`${ID}'`)).rejects.toThrow(/^refusing /)
  })

  test('full photo access is asked for read and write, with the recorder paused', async () => {
    await expect(requestFullPhotoAccess()).resolves.toEqual({granted: true, readAccess: 'all'})
    expect(mockApp.log).toEqual(['pause', 'media permission request read', 'resume tok'])
  })

  test('whether the library holds an asset is read over the whole library, for an asset id only', async () => {
    mockApp.assets = [{height: 48, id: ID, mediaType: 'image', width: 64}]
    await expect(libraryHasAsset(ID)).resolves.toBe(true)
    await expect(libraryHasAsset(OTHER)).resolves.toBe(false)
    await expect(libraryHasAsset(`${ID}'`)).rejects.toThrow(/^refusing /)
  })

  test("the phone's downloads, each with whether it is done or cancelled", async () => {
    mockApp.downloads = [{canceled: true, done: false, downloadID: 'd1'}]
    await expect(phoneDownloads()).resolves.toEqual([{canceled: true, done: false, downloadID: 'd1'}])
    mockApp.downloads = []
    await expect(phoneDownloads()).resolves.toEqual([])
  })

  test('deletes the exact asset the test saved, never one the library held before the test', async () => {
    mockApp.assets = [{height: 48, id: OTHER, mediaType: 'image', width: 64}, {height: 48, id: ID, mediaType: 'image', width: 64}]
    await deleteSavedAsset(ID, new Set([OTHER]))
    expect(mockApp.log.filter(l => l.startsWith('delete'))).toEqual([`delete asset ${ID}`])
    expect(mockApp.assets.map(a => a.id)).toEqual([OTHER])
    mockApp.log = []
    await expect(deleteSavedAsset(OTHER, new Set([OTHER]))).rejects.toThrow(/^refusing /)
    for (const bad of ['', '*', `${ID}'`, 'all']) await expect(deleteSavedAsset(bad, new Set())).rejects.toThrow(/^refusing /)
    expect(mockApp.log).toEqual([])
  })
})
