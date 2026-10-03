// Captures tour entries from the dev iOS app on a simulator: Appium (a standalone webdriverio
// session) for screenshots, element rects and setup taps; Metro's inspector for JS eval. The app's
// router is reached as the constants/router.tsx module (desktop's DEBUGRouter2 global points at the
// same module; native never sets that global). Navigation is reset/append only; nothing that changes
// account state is ever tapped.
import {execFileSync, spawn, type ChildProcess} from 'child_process'
import * as http from 'http'
import * as path from 'path'
import {fileURLToPath} from 'url'
import {homedir} from 'os'
import {remote} from 'webdriverio'
import {iosCapabilities, udidForName} from '../ios-appium/helpers/app.ts'
import {evalInPage, inspectorPageFor} from '../shared/metro-eval.ts'
import {fixDate, settle, waitFor, withDeadline, type Capture} from './driver-desktop.mts'
import type {Rect} from './compare.mts'
import {resolveParams} from './resolve.mts'
import type {Theme, TourEntry, SetupStep} from './tour-types.ts'

export type IosSession = {
  prepare: (opts: {theme: Theme; frozenAt: number; reload: boolean}) => Promise<void>
  capture: (entry: TourEntry) => Promise<Capture>
  // Restores the app (real Date, which takes a JS reload) and the simulator settings prepare
  // changed, ends the Appium session and stops the Appium server this session started.
  close: () => Promise<void>
}

const BUNDLE_ID = 'keybase.ios'
const SHARED_DIR = fileURLToPath(new URL('../../../', import.meta.url))
const APPIUM_START_MS = 30_000
const APPIUM_STOP_MS = 5_000
// a fresh WDA launch can take most of the capability's 120s wdaLaunchTimeout
const SESSION_MS = 180_000
const SIMCTL_MS = 10_000
const EVAL_MS = 5_000
const APP_CMD_MS = 30_000
const BOOT_MS = 90_000
const RESET_MS = 5_000
const READY_MS = 10_000
const SETUP_MS = 5_000
const SETTLE = {deadlineMs: 5_000, intervalMs: 250}

export const appiumHome = () => process.env['APPIUM_HOME'] || `${homedir()}/.appium`
export const appiumPort = () => Number(process.env['KB_APPIUM_PORT'] ?? 4723)
// As in ios-appium/wdio.conf.ts: a non-default Appium port gets its own WDA port, so parallel
// simulators don't both take 8100.
export const visualCapabilities = (udid: string) => {
  const port = appiumPort()
  return iosCapabilities(udid, {wdaLocalPort: port === 4723 ? undefined : 8100 + (port - 4723)})
}

export const STATUS_BAR_ARGS: ReadonlyArray<string> = [
  '--time', '9:41',
  '--dataNetwork', 'wifi',
  '--wifiMode', 'active',
  '--wifiBars', '3',
  '--cellularMode', 'active',
  '--cellularBars', '4',
  '--batteryState', 'charged',
  '--batteryLevel', '100',
]

const simctl = (...args: Array<string>) =>
  execFileSync('xcrun', ['simctl', ...args], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: SIMCTL_MS}).trim()

// Accessibility settings a visual run turns on:
// - Reduce Motion: Reanimated animations (its default ReduceMotion.System) jump to their end.
// - Reduce Transparency: the iOS 26 glass tab bar otherwise samples the content scrolled under it,
//   and the sample depends on what was drawn before, so the same screen captured twice differs.
export const ACCESSIBILITY_KEYS: ReadonlyArray<string> = ['ReduceMotionEnabled', 'EnhancedBackgroundContrastEnabled']

const accessibilityDefaults = (udid: string, key: string, verb: 'read' | 'write' | 'delete', ...value: Array<string>) =>
  simctl('spawn', udid, 'defaults', verb, 'com.apple.Accessibility', key, ...value)

// The key's current value ('1' or '0'), or undefined when it was never set.
const readAccessibility = (udid: string, key: string) => {
  try {
    return accessibilityDefaults(udid, key, 'read')
  } catch {
    return undefined
  }
}

// node's http rather than fetch: this file is also type-checked against react-native's fetch
const appiumUp = async (port: number) =>
  new Promise<boolean>(resolve => {
    const req = http.get({host: '127.0.0.1', path: '/status', port, timeout: 1_000}, res => {
      res.resume()
      resolve(res.statusCode === 200)
    })
    req.on('timeout', () => req.destroy())
    req.on('error', () => resolve(false))
  })

const startAppium = async (port: number): Promise<ChildProcess> => {
  if (await appiumUp(port)) {
    throw new Error(`something already answers on port ${port}; stop it or set KB_APPIUM_PORT`)
  }
  const child = spawn(
    path.join(SHARED_DIR, 'node_modules', '.bin', 'appium'),
    ['--port', String(port), '--base-path', '/', '--log-level', 'error'],
    {env: {...process.env, APPIUM_HOME: appiumHome()}, stdio: ['ignore', 'ignore', 'pipe']}
  )
  let stderr = ''
  child.stderr.on('data', (d: Buffer) => {
    stderr = (stderr + d.toString()).slice(-2_000)
  })
  try {
    await waitFor(`Appium to answer on port ${port}`, APPIUM_START_MS, async () => {
      if (child.exitCode !== null) throw new Error(`Appium exited with ${child.exitCode}: ${stderr}`)
      return appiumUp(port)
    })
  } catch (e) {
    await stopAppium(child)
    throw e
  }
  return child
}

const stopAppium = async (child: ChildProcess) => {
  if (child.exitCode !== null || child.signalCode !== null) return
  const exited = new Promise(resolve => child.once('exit', resolve))
  child.kill('SIGTERM')
  try {
    await withDeadline(exited, APPIUM_STOP_MS, 'Appium to exit')
  } catch {
    child.kill('SIGKILL')
  }
}

const ROUTER = `const r = kbModule('constants/router.tsx');`
const HOP_TAB = 'tabs.settingsTab'
const HOP_TAB_ALT = 'tabs.peopleTab'

export async function openIos(opts: {device: string}): Promise<IosSession> {
  const {device} = opts
  const udid = udidForName(device)
  const port = appiumPort()
  const appium = await startAppium(port)
  let browser: WebdriverIO.Browser
  try {
    browser = await withDeadline(
      remote({
        capabilities: visualCapabilities(udid),
        connectionRetryCount: 0,
        hostname: '127.0.0.1',
        logLevel: 'error',
        path: '/',
        port,
      }),
      SESSION_MS,
      'starting the Appium session'
    )
  } catch (e) {
    await stopAppium(appium)
    throw e
  }

  const appEval = async <R,>(body: string, what: string) =>
    withDeadline(
      (async () => evalInPage<R>(await inspectorPageFor(device, BUNDLE_ID), body))(),
      EVAL_MS,
      what
    )
  const appCmd = async <R,>(p: Promise<R>, what: string) => withDeadline(p, APP_CMD_MS, what)

  // A token set on the JS runtime; a runtime without it is a fresh one (after a reload or relaunch).
  // Metro keeps the same inspector page across reloads, so the page alone can't tell.
  let runtimeToken = ''
  const markRuntime = async () => {
    runtimeToken = `${Date.now()}-${Math.random()}`
    await appEval(`globalThis.__kbVisualRuntime = ${JSON.stringify(runtimeToken)}`, 'marking the JS runtime')
  }
  // A logged in runtime with the router and the waiting store up; with `fresh`, also one that
  // started after the last markRuntime.
  const waitForRuntime = async (fresh: boolean) => {
    let last = ''
    try {
      await waitFor(`a ${fresh ? 'fresh, ' : ''}logged in JS runtime`, BOOT_MS, async () => {
        try {
          const r = await appEval<{fresh: boolean; loggedIn: boolean; waiting: boolean}>(
            `${ROUTER}
             const root = r.getRootState()
             return {
               fresh: globalThis.__kbVisualRuntime !== ${JSON.stringify(runtimeToken)},
               loggedIn: root?.routes?.[0]?.name === 'loggedIn',
               waiting: !!globalThis.__ZUSTAND_HMR__?.get('waiting'),
             }`,
            'reading the JS runtime'
          )
          last = JSON.stringify(r)
          return (r.fresh || !fresh) && r.loggedIn && r.waiting
        } catch (e) {
          last = (e as Error).message
          return false
        }
      })
    } catch (e) {
      throw new Error(`${(e as Error).message} (last: ${last})`, {cause: e})
    }
  }
  const reloadJs = async () => {
    await markRuntime()
    await appEval(
      `setTimeout(() => {
         const m = kbModule('node_modules/react-native/Libraries/Utilities/DevSettings.js')
         ;(m.default ?? m).reload()
       }, 0)`,
      'DevSettings.reload'
    )
    await waitForRuntime(true)
  }
  const relaunchApp = async () => {
    await markRuntime().catch(() => {})
    await appCmd(browser.terminateApp(BUNDLE_ID), 'terminating the app')
    await appCmd(browser.activateApp(BUNDLE_ID), 'activating the app')
    await waitForRuntime(true)
  }

  // Reanimated reads Reduce Motion once, when its native module starts; RN's AccessibilityInfo
  // answers asynchronously, so its answer is parked on a global and polled.
  const accessibilityOn = async () => {
    const token = `${Date.now()}-${Math.random()}`
    await appEval(
      `const m = kbModule('node_modules/react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo.js')
       const A = m.default ?? m
       Promise.all([A.isReduceMotionEnabled(), A.isReduceTransparencyEnabled()]).then(v => {
         globalThis.__kbVisualAccessibility = {token: ${JSON.stringify(token)}, motion: v[0], transparency: v[1]}
       })`,
      'asking AccessibilityInfo'
    )
    let got: {reanimated: boolean; motion?: boolean; transparency?: boolean} | undefined
    await waitFor('AccessibilityInfo to answer', EVAL_MS, async () => {
      got = await appEval(
        `const a = globalThis.__kbVisualAccessibility
         if (a?.token !== ${JSON.stringify(token)}) return undefined
         return {reanimated: globalThis._REANIMATED_IS_REDUCED_MOTION === true, motion: a.motion, transparency: a.transparency}`,
        'reading AccessibilityInfo'
      )
      return !!got
    })
    return !!got && got.reanimated && got.motion === true && got.transparency === true
  }

  const routerAt = async () =>
    appEval<{atRoot: boolean; tab: string | undefined}>(
      `${ROUTER}
       const root = r.getRootState()
       if (!root) throw new Error('no navigation state')
       const tab = r.getTab()
       const tabRoute = root.routes?.[0]?.state?.routes?.find(x => x.name === tab)
       const stackDepth = tabRoute?.state?.routes?.length ?? 1
       return {atRoot: root.routes?.length === 1 && stackDepth === 1, tab}`,
      'reading the router state'
    )
  const switchTo = async (tab: string) => {
    await appEval(`${ROUTER} r.switchTab(${JSON.stringify(tab)})`, `switching to ${tab}`)
    await waitFor(`tab ${tab} to be current`, RESET_MS, async () => (await routerAt()).tab === tab)
  }
  // The glass tab bar's rendering depends on which tab was selected before (seen live: files after
  // chat differs from files after teams), so every capture arrives from the same tab.
  const resetTo = async (tab: string) => {
    await appEval(`${ROUTER} r.clearModals()`, 'clearModals')
    await switchTo(tab === HOP_TAB ? HOP_TAB_ALT : HOP_TAB)
    await settle(screenshot, SETTLE)
    await switchTo(tab)
    await appEval(`${ROUTER} r.popStack()`, 'popStack')
    await waitFor(`the root of ${tab}`, RESET_MS, async () => (await routerAt()).atRoot)
  }

  // The app follows the system appearance while its preference is 'system'. Any other preference
  // is switched to 'system' in the JS store only (never written to config); a reload reads the real
  // preference back.
  const applyLight = async () =>
    waitFor('the app to be in light mode', RESET_MS, async () =>
      appEval<boolean>(
        `const store = globalThis.__ZUSTAND_HMR__?.get('darkmode')
         if (!store) throw new Error('the darkmode store is not in __ZUSTAND_HMR__; is this a dev build?')
         if (store.getState().darkModePreference !== 'system') store.setState({darkModePreference: 'system'})
         return !store.getState().isDarkMode()`,
        'reading the dark mode store'
      )
    )

  const waitForNoLoading = async () => {
    let busy: Array<string> = []
    try {
      await waitFor('the waiting store to be idle', READY_MS, async () => {
        busy = await appEval<Array<string>>(
          `return Array.from(globalThis.__ZUSTAND_HMR__.get('waiting').getState().counts.keys())`,
          'reading the waiting store'
        )
        return busy.length === 0
      })
    } catch (e) {
      throw new Error(`${(e as Error).message}: ${busy.join(', ')}`, {cause: e})
    }
  }

  const byTestID = (id: string) => browser.$(`~${id}`)

  const runStep = async (s: SetupStep) => {
    switch (s.kind) {
      case 'openPopup':
      case 'switchSubTab':
        await withDeadline(byTestID(s.testID).click(), SETUP_MS, `${s.kind} ${s.testID}`)
        return
      case 'scrollIntoView': {
        const elementId = await withDeadline(byTestID(s.testID).elementId, SETUP_MS, `finding ${s.testID}`)
        await withDeadline(browser.execute('mobile: scroll', {elementId, toVisible: true}), SETUP_MS, `scrolling to ${s.testID}`)
        return
      }
      case 'hover':
        throw new Error(`hover ${s.testID}: hover is desktop only`)
    }
  }

  const screenshot = async () =>
    Buffer.from(await withDeadline(browser.takeScreenshot(), EVAL_MS, 'taking a screenshot'), 'base64')

  // Screenshot pixels per window point.
  let scale: number | undefined
  const screenScale = async () => {
    if (scale === undefined) {
      const info = await withDeadline(
        browser.execute('mobile: deviceScreenInfo') as Promise<{scale?: number}>,
        EVAL_MS,
        'mobile: deviceScreenInfo'
      )
      if (!info.scale) throw new Error('mobile: deviceScreenInfo returned no scale')
      scale = info.scale
    }
    return scale
  }

  const maskRects = async (entry: TourEntry) => {
    const s = await screenScale()
    const rects: Array<Rect> = []
    for (const m of entry.masks ?? []) {
      const all = await withDeadline(Promise.resolve(browser.$$(`~${m.testID}`).getElements()), SETUP_MS, `finding mask ${m.testID}`)
      if (all.length === 0) throw new Error(`mask target ${m.testID} is not on screen`)
      for (const e of all) {
        const r = await withDeadline(browser.getElementRect(e.elementId), SETUP_MS, `rect of ${m.testID}`)
        rects.push({height: r.height * s, width: r.width * s, x: r.x * s, y: r.y * s})
      }
    }
    return rects
  }

  // Visits every phone tab once. A tab's first visit after a reload lays its header title out a
  // fraction of a pixel off from every later visit (stable either way), so captures are only
  // comparable when none of them is a first visit.
  const warmTabs = async () => {
    const tabs = await appEval<Array<string>>(`return kbModule('constants/tabs.tsx').phoneTabs`, 'reading the phone tabs')
    for (const tab of tabs) {
      await switchTo(tab)
      await waitForNoLoading()
      await settle(screenshot, SETTLE)
    }
  }

  const coverageSeq = async () =>
    appEval<number | null>('return globalThis.__kbVisualCoverage?.seq() ?? null', 'coverage seq')
  const coverageSince = async (seq: number | null) =>
    seq === null
      ? null
      : appEval<Array<string> | null>(`return globalThis.__kbVisualCoverage?.mountedSince(${seq}) ?? null`, 'coverage mountedSince')

  let prepared = false
  let datePatched = false
  // what prepare found, so close can put it back
  let original: {accessibility: Array<{key: string; value: string | undefined}>; appearance: string} | undefined

  const prepare: IosSession['prepare'] = async p => {
    if (p.theme !== 'light') throw new Error(`iOS captures are light only (asked for ${p.theme})`)
    original ??= {
      accessibility: ACCESSIBILITY_KEYS.map(key => ({key, value: readAccessibility(udid, key)})),
      appearance: simctl('ui', udid, 'appearance'),
    }
    simctl('status_bar', udid, 'override', ...STATUS_BAR_ARGS)
    const bar = simctl('status_bar', udid, 'list')
    if (!bar.includes('9:41')) throw new Error(`the status bar override did not take: ${bar}`)
    simctl('ui', udid, 'appearance', 'light')
    // UIKit and Reanimated read these when the app starts, so changing one takes a relaunch.
    let changed = false
    for (const key of ACCESSIBILITY_KEYS) {
      if (readAccessibility(udid, key) !== '1') {
        accessibilityDefaults(udid, key, 'write', '-bool', 'true')
        changed = true
      }
    }
    await waitForRuntime(false)
    if (changed || !(await accessibilityOn())) await relaunchApp()
    else if (p.reload) await reloadJs()
    if (!(await accessibilityOn())) throw new Error('the app does not report Reduce Motion and Reduce Transparency after a relaunch')
    await appEval(`(${fixDate.toString()})(${p.frozenAt})`, 'fixing Date')
    datePatched = true
    const now = await appEval<number>('return Date.now()', 'reading Date.now')
    if (now !== p.frozenAt) throw new Error(`Date is not fixed in the app: Date.now() is ${now}, wanted ${p.frozenAt}`)
    await applyLight()
    await warmTabs()
    prepared = true
  }

  const capture: IosSession['capture'] = async entry => {
    let png: Buffer | undefined
    try {
      if (!prepared) throw new Error('capture called before prepare')
      // before the reset, so coverage includes what switching to the tab mounts
      const seq = await coverageSeq()
      await resetTo(entry.nav.tab)
      const nav = await resolveParams(entry.nav)
      const append = nav.append
      if (append) {
        const ok = await appEval<boolean>(
          `${ROUTER} return r.navigateAppend(${JSON.stringify({name: append.name, params: append.params})})`,
          `navigateAppend ${append.name}`
        )
        if (!ok) throw new Error(`navigateAppend ${append.name} did not navigate`)
      }
      await byTestID(entry.ready).waitForDisplayed({
        interval: 150,
        timeout: READY_MS,
        timeoutMsg: `testID ${entry.ready} was not displayed after ${READY_MS / 1000}s`,
      })
      await waitForNoLoading()
      for (const s of entry.setup ?? []) await runStep(s)
      const settled = await settle(async () => {
        png = await screenshot()
        return png
      }, SETTLE)
      png = settled.png
      const masks = await maskRects(entry)
      const coverage = await coverageSince(seq)
      return {coverage, masks, png, status: settled.stable ? 'ok' : 'unstable'}
    } catch (e) {
      return {coverage: null, error: (e as Error).message, masks: [], png: png ?? Buffer.alloc(0), status: 'failed'}
    }
  }

  const close: IosSession['close'] = async () => {
    try {
      if (datePatched) {
        datePatched = false
        await reloadJs()
      }
    } finally {
      const quiet = (f: () => unknown) => {
        try {
          f()
        } catch {}
      }
      quiet(() => simctl('status_bar', udid, 'clear'))
      if (original) {
        const {accessibility, appearance} = original
        if (appearance === 'light' || appearance === 'dark') quiet(() => simctl('ui', udid, 'appearance', appearance))
        for (const {key, value} of accessibility) {
          quiet(() =>
            value === undefined
              ? accessibilityDefaults(udid, key, 'delete')
              : accessibilityDefaults(udid, key, 'write', '-bool', value === '1' ? 'true' : 'false')
          )
        }
      }
      await withDeadline(browser.deleteSession(), APP_CMD_MS, 'ending the Appium session').catch(() => {})
      await stopAppium(appium)
    }
  }

  return {capture, close, prepare}
}
