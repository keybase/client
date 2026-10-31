import * as fs from 'fs'
import * as mockFs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {newRunId} from '../../accounts/run-id'
import {clearLocation, ensurePhotoCorpus, grantPrivacy, launchedBy, launchIfGone, openLink, pushNotification, restorePrivacy, toBackground, toForeground} from './device'
import {chatNewMessagePayload} from './device-lib'
import {clearGatePoison, gatePoisoned} from './poison-lib'

// jest's globals (this project's types are mocha's and wdio's)
declare const jest: {
  mock: (path: string, factory: () => unknown) => void
}

const UDID = 'B338EAF5-6A0E-4CAF-BD25-446C674751FB'

const mockDevice = {
  calls: [] as Array<string>,
  // the e2e config dir (never the real ~/.config/keybase-e2e)
  configDir: '',
  // the simulator data's identity
  data: 1,
  credits: [] as Array<string>,
  // a link openurl fails on
  openFails: false,
  // the app's pid, undefined while it is not running, and its JS runtime
  pid: 1 as number | undefined,
  runtime: 'r1' as string | undefined,
  // XCUITest's app state (4: in front), and whether the next runtime read sees the app exit
  appState: 4,
  exitsOnEval: false,
  // a push file as simctl saw it
  pushed: [] as Array<{argv: string; file: string; mode: number; body: string}>,
  pushFails: false,
  simctlFails: '',
  tcc: '',
}

jest.mock('../helpers/lifecycle', () => ({
  BUNDLE_ID: 'keybase.ios',
  activateApp: async () => {
    mockDevice.calls.push('activate')
    mockDevice.appState = 4
    return Promise.resolve()
  },
  appPid: () => mockDevice.pid,
  appState: async () => Promise.resolve(mockDevice.appState),
  backgroundApp: async () => {
    mockDevice.calls.push('background')
    return Promise.resolve()
  },
  // a name lookup's answer, which nothing outside the app may use
  deviceUdid: () => '00000000-1111-2222-3333-444444444444',
  jsEval: async () => {
    if (mockDevice.exitsOnEval) mockDevice.pid = undefined
    return Promise.resolve(mockDevice.runtime)
  },
  lookFor: async () => Promise.resolve(undefined),
  openUrl: (url: string) => {
    mockDevice.calls.push('openurl')
    if (mockDevice.openFails) throw Object.assign(new Error(`Command failed: xcrun simctl openurl ${UDID} ${url}`), {status: 3})
  },
  setLocation: () => {},
  simctl: (...args: Array<string>) => {
    mockDevice.calls.push(`simctl ${args.join(' ')}`)
    if (mockDevice.simctlFails && args.join(' ').includes(mockDevice.simctlFails)) throw new Error('simctl exit 1')
    return ''
  },
  terminateApp: async () => {
    mockDevice.calls.push('terminate')
    mockDevice.pid = undefined
    mockDevice.runtime = undefined
    return Promise.resolve()
  },
  // one look: what it checks either holds now or the wait times out
  waitFor: async (what: string, check: () => unknown) => {
    const r = await check()
    if (r === undefined) throw new Error(`timed out waiting for ${what}`)
    return r
  },
}))
jest.mock('../../accounts/env.ts', () => ({e2eConfigDir: () => mockDevice.configDir}))
jest.mock('./sim-data.ts', () => ({simulatorDataBirth: () => mockDevice.data}))
jest.mock('../helpers/app', () => ({
  runSync: (file: string) => {
    if (file !== 'sqlite3') throw new Error(`unexpected ${file}`)
    return mockDevice.tcc
  },
}))
jest.mock('child_process', () => ({
  execFileSync: (_file: string, args: Array<string>) => {
    const file = args[args.length - 1] as string
    mockDevice.pushed.push({argv: args.slice(0, 3).join(' '), body: mockFs.readFileSync(file, 'utf8'), file, mode: mockFs.statSync(file).mode & 0o777})
    if (mockDevice.pushFails) throw Object.assign(new Error(`Command failed: xcrun ${args.join(' ')}`), {status: 2})
    return ''
  },
}))
jest.mock('./attempt.ts', () => ({
  attemptToken: () => 'token',
  creditSurface: (s: string) => void mockDevice.credits.push(s),
  openAttemptToken: () => 'token',
  requireCurrentAttempt: () => {},
}))
jest.mock('./errors.ts', () => ({ensureErrorCapture: async () => Promise.resolve(), takeErrors: async () => Promise.resolve([])}))
jest.mock('./app-log.ts', () => ({installAppLogCapture: async () => Promise.resolve()}))
jest.mock('./recording.ts', () => ({
  attemptRecording: () => ({
    checkpoint: async () => {
      mockDevice.calls.push('checkpoint')
      return Promise.resolve()
    },
  }),
  recorders: new Map(),
}))

let home = ''
const savedEnv = {runId: process.env['KB_E2E_RUN_ID'], udid: process.env['KB_IOS_UDID']}
beforeEach(() => {
  home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'device-test-')))
  mockDevice.configDir = path.join(home, 'keybase-e2e')
  process.env['KB_IOS_UDID'] = UDID
  process.env['KB_E2E_RUN_ID'] = newRunId()
  mockDevice.calls = []
  mockDevice.credits = []
  mockDevice.pushed = []
  mockDevice.pushFails = false
  mockDevice.simctlFails = ''
  mockDevice.tcc = ''
  mockDevice.data = 1
  mockDevice.openFails = false
  mockDevice.pid = 1
  mockDevice.runtime = 'r1'
  mockDevice.appState = 4
  mockDevice.exitsOnEval = false
})
afterEach(() => {
  if (savedEnv.udid === undefined) delete process.env['KB_IOS_UDID']
  else process.env['KB_IOS_UDID'] = savedEnv.udid
  if (savedEnv.runId === undefined) delete process.env['KB_E2E_RUN_ID']
  else process.env['KB_E2E_RUN_ID'] = savedEnv.runId
  fs.rmSync(home, {force: true, recursive: true})
  for (const s of ['photos', 'location-always']) clearGatePoison(`the ${s} permission for keybase.ios`)
  clearGatePoison('the simulated location')
  clearGatePoison('the Keybase app')
})

test('device.ts never credits a surface: the flow credits once it has asserted the outcome', () => {
  const text = fs.readFileSync(path.join(__dirname, 'device.ts'), 'utf8')
  expect(text).not.toMatch(/creditSurface\s*\(/)
  // the scan reads the real file, so a missing file is not a scan that matched nothing
  expect(text).toMatch(/export const toForeground/)
})

test('a background then a foreground only moves the app: it credits nothing', async () => {
  await toBackground()
  await toForeground()
  expect(mockDevice.calls).toEqual(['background', 'activate'])
  expect(mockDevice.credits).toEqual([])
})

describe('a push', () => {
  const payload = () =>
    chatNewMessagePayload({
      body: `e2e-${process.env['KB_E2E_RUN_ID']}-push-fg-1a2b3c4d`,
      convID: '0000f0b5c2c2211c8d67ed15e75e656c7862d086e9245420892a7de62cd9ec58',
      uid: '0123456789abcdef0123456789abcd19',
    })

  test('goes through a mode 600 file under /tmp/kb-e2e named for the run, removed after', () => {
    pushNotification(payload())
    pushNotification(payload())
    const runId = process.env['KB_E2E_RUN_ID'] ?? ''
    expect(mockDevice.pushed.map(p => p.file)).toEqual([`/tmp/kb-e2e/push-${runId}-1.json`, `/tmp/kb-e2e/push-${runId}-2.json`])
    for (const p of mockDevice.pushed) {
      expect(p.argv).toBe(`simctl push ${UDID}`)
      expect(p.mode).toBe(0o600)
      expect(JSON.parse(p.body)).toEqual(payload())
      expect(fs.existsSync(p.file)).toBe(false)
    }
  })

  test('a failed push names neither the file nor the command line, and still removes the file', () => {
    mockDevice.pushFails = true
    let err = ''
    try {
      pushNotification(payload())
    } catch (e) {
      err = String(e)
    }
    expect(err).toMatch(/simctl push failed \(exit 2\)/)
    expect(err).not.toMatch(/kb-e2e|push-|\.json|B338EAF5/)
    expect(fs.existsSync(mockDevice.pushed[0]?.file ?? '/')).toBe(false)
  })

  test('goes only to the udid preflight proved: without it nothing is written or sent', () => {
    delete process.env['KB_IOS_UDID']
    expect(() => pushNotification(payload())).toThrow(/KB_IOS_UDID/)
    expect(mockDevice.pushed).toEqual([])
  })

  test('a silent push is refused before any file is written', () => {
    expect(() => pushNotification({...payload(), type: 'chat.newmessageSilent_2'})).toThrow(/^refusing /)
    expect(mockDevice.pushed).toEqual([])
  })
})

describe('privacy', () => {
  test("a grant reads the original from TCC first and returns the token that puts it back", async () => {
    mockDevice.tcc = '[{"service":"kTCCServicePhotos","auth_value":0}]'
    const t = await grantPrivacy('photos')
    expect(t).toEqual({done: false, original: {bundleId: 'keybase.ios', service: 'photos', state: 'denied'}, udid: UDID})
    expect(mockDevice.calls).toContain(`simctl privacy ${UDID} grant photos keybase.ios`)
    mockDevice.calls = []
    mockDevice.tcc = '[{"service":"kTCCServicePhotos","auth_value":2}]'
    expect(() => restorePrivacy(t)).toThrow(/still reads granted/)
    expect(mockDevice.calls).toEqual([`simctl privacy ${UDID} revoke photos keybase.ios`])
    mockDevice.tcc = '[{"service":"kTCCServicePhotos","auth_value":0}]'
    restorePrivacy(t)
    restorePrivacy(t)
    expect(mockDevice.calls).toEqual([`simctl privacy ${UDID} revoke photos keybase.ios`])
    expect(gatePoisoned()).toBeUndefined()
  })

  test('a grant it could not put back is refused before anything changes', async () => {
    mockDevice.tcc = '[{"service":"kTCCServicePhotos","auth_value":3}]'
    await expect(grantPrivacy('photos')).rejects.toThrow(/limited/)
    expect(mockDevice.calls.filter(c => c.startsWith('simctl privacy'))).toEqual([])
  })

  test('without the udid preflight proved, nothing is granted', async () => {
    delete process.env['KB_IOS_UDID']
    await expect(grantPrivacy('photos')).rejects.toThrow(/KB_IOS_UDID/)
    expect(mockDevice.calls).toEqual([])
  })
})

test('clearing the location runs simctl only, and a failed clear poisons the gate', () => {
  clearLocation()
  expect(mockDevice.calls).toEqual([`simctl location ${UDID} clear`])
  mockDevice.simctlFails = 'location'
  expect(() => clearLocation()).toThrow(/simulated location/)
  expect(gatePoisoned()).toMatch(/the simulated location \(run xcrun simctl location B338EAF5-6A0E-4CAF-BD25-446C674751FB clear\)/)
  mockDevice.simctlFails = ''
  clearLocation()
  expect(gatePoisoned()).toBeUndefined()
})

describe('the photo corpus', () => {
  const record = () => path.join(home, 'keybase-e2e', 'ios-photo-corpus.json')
  const added = () => mockDevice.calls.filter(c => c.startsWith('simctl addmedia'))

  test('is added once per simulator: recorded mode 600 with its udid and sha256s, its copies removed', async () => {
    const items = await ensurePhotoCorpus()
    expect(items.map(i => i.name)).toEqual(['e2e-c.png', 'e2e-c.jpg', 'e2e-c.heic', 'e2e-c.gif', 'e2e-c-large.png', 'e2e-c.mp4', 'e2e-c.mov'])
    expect(items.every(i => /^[0-9a-f]{64}$/.test(i.sha256))).toBe(true)
    const runId = process.env['KB_E2E_RUN_ID'] ?? ''
    expect(added()).toEqual(items.map(i => `simctl addmedia ${UDID} /tmp/kb-e2e/media-${runId}/${i.name}`))
    expect(fs.existsSync(`/tmp/kb-e2e/media-${runId}`)).toBe(false)
    expect(fs.statSync(record()).mode & 0o777).toBe(0o600)
    expect(JSON.parse(fs.readFileSync(record(), 'utf8'))).toEqual({[UDID]: {data: 1, items: items.map(i => ({name: i.name, sha256: i.sha256}))}})
    mockDevice.calls = []
    await ensurePhotoCorpus()
    expect(added()).toEqual([])
  })

  test("is added again once the simulator's data changes (an erase), and the record keeps the new data's items only", async () => {
    const items = await ensurePhotoCorpus()
    mockDevice.calls = []
    mockDevice.data = 2
    await ensurePhotoCorpus()
    expect(added()).toHaveLength(items.length)
    expect(JSON.parse(fs.readFileSync(record(), 'utf8'))).toEqual({[UDID]: {data: 2, items: items.map(i => ({name: i.name, sha256: i.sha256}))}})
    mockDevice.calls = []
    await ensurePhotoCorpus()
    expect(added()).toEqual([])
  })

  test('an add that fails records nothing for that item and stops', async () => {
    mockDevice.simctlFails = 'e2e-c.jpg'
    await expect(ensurePhotoCorpus()).rejects.toThrow('simctl exit 1')
    expect((JSON.parse(fs.readFileSync(record(), 'utf8')) as Record<string, {items: Array<{name: string}>}>)[UDID]?.items.map(i => i.name)).toEqual([
      'e2e-c.png',
    ])
    const runId = process.env['KB_E2E_RUN_ID'] ?? ''
    expect(fs.existsSync(`/tmp/kb-e2e/media-${runId}`)).toBe(false)
    mockDevice.simctlFails = ''
    mockDevice.calls = []
    await ensurePhotoCorpus()
    expect(added()[0]).toMatch(/e2e-c\.jpg$/)
    expect(added()).toHaveLength(6)
  })
})

describe('a link', () => {
  test('that fails to open names neither the link nor the command line', () => {
    mockDevice.openFails = true
    let message = ''
    try {
      openLink('keybase://profile/show/testuser')
    } catch (e) {
      message = e instanceof Error ? e.message : String(e)
    }
    expect(message).toBe('simctl openurl failed (exit 3)')
    expect(mockDevice.credits).toEqual([])
  })
})

describe('a launch by what was delivered', () => {
  // what a link or a tapped banner does: iOS starts the app on a new runtime
  const startsApp = () => {
    mockDevice.calls.push('deliver')
    mockDevice.pid = 2
    mockDevice.runtime = 'r2'
  }

  test('terminates the app, delivers, and waits for the new runtime without launching the app itself', async () => {
    await launchedBy(startsApp)
    expect(mockDevice.calls).toEqual(['checkpoint', 'terminate', 'deliver', 'checkpoint'])
    expect(mockDevice.credits).toEqual([])
  })

  test('fails when what was delivered did not start the app, and never starts it itself', async () => {
    await expect(launchedBy(() => void mockDevice.calls.push('deliver'))).rejects.toThrow(/the app to launch from what was delivered/)
    expect(mockDevice.calls.some(c => c.startsWith('simctl launch'))).toBe(false)
  })

  test('fails when the app it delivered to exits before its runtime starts, and never starts it again', async () => {
    await expect(
      launchedBy(() => {
        mockDevice.pid = 2
        mockDevice.exitsOnEval = true
      })
    ).rejects.toThrow(/the app exited after what was delivered launched it/)
    expect(mockDevice.calls.some(c => c.startsWith('simctl launch'))).toBe(false)
  })
})

describe('the app launched again by a hook', () => {
  test('runs nothing while the app is up in front', async () => {
    await launchIfGone()
    expect(mockDevice.calls).toEqual([])
  })

  test('launches an app a test left terminated, on the udid preflight proved, and waits for its runtime', async () => {
    mockDevice.pid = undefined
    mockDevice.runtime = 'r2'
    await launchIfGone()
    expect(mockDevice.calls).toEqual([`simctl launch ${UDID} keybase.ios`])
    expect(gatePoisoned()).toBeUndefined()
  })

  test('brings an app a test left in the background to the front without relaunching it', async () => {
    mockDevice.appState = 3
    await launchIfGone()
    expect(mockDevice.calls).toEqual(['activate'])
    expect(gatePoisoned()).toBeUndefined()
  })

  test('waits for the runtime of an app that has a pid but no runtime yet', async () => {
    mockDevice.runtime = undefined
    await expect(launchIfGone()).rejects.toThrow(/the app to have its JS runtime/)
    expect(mockDevice.calls.some(c => c.startsWith('simctl launch'))).toBe(false)
  })

  test('poisons the gate when the app does not come back, and a later launch that works clears it', async () => {
    mockDevice.pid = undefined
    mockDevice.runtime = undefined
    await expect(launchIfGone()).rejects.toThrow(/bringing the Keybase app back failed/)
    expect(gatePoisoned()).toBeDefined()
    mockDevice.runtime = 'r2'
    await launchIfGone()
    expect(gatePoisoned()).toBeUndefined()
  })
})
