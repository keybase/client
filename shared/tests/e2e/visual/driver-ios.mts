// The iOS device for a capture session (driver-native.mts runs the app's half): Appium (a standalone
// webdriverio session) for screenshots, element rects and setup taps, simctl for the simulator's
// settings.
import {execFileSync, spawn, type ChildProcess} from 'child_process'
import * as http from 'http'
import * as path from 'path'
import {fileURLToPath} from 'url'
import {homedir} from 'os'
import {remote} from 'webdriverio'
import {iosCapabilities, iosUdid, pidFromLaunchctl} from '../ios-appium/helpers/app.ts'
import {screenshotDisplayOf, simctlScreenshot, touchInner} from '../ios-appium/helpers/form-factor.mts'
import type {StoreTarget} from './store.mts'
import {waitFor} from './driver-desktop.mts'
import {withDeadline} from '../shared/deadline.ts'
import {clipToWindow, openNative, type NativeDevice, type NativeSession} from './driver-native.mts'
import type {Rect} from './compare.mts'

export type IosOriginal ={accessibility: Array<{key: string; value: string | undefined}>; appearance: string}

// `original` is what prepare found (undefined before prepare touched the simulator); `appium` is
// whether the Appium server this session started may still be running.
export const iosCleanupCommands = (opts: {udid: string; port: number; original: IosOriginal | undefined; appium: boolean}) => {
  const {udid, original} = opts
  const out: Array<string> = []
  if (original) {
    out.push(`xcrun simctl status_bar ${udid} clear`)
    if (original.appearance === 'light' || original.appearance === 'dark') {
      out.push(`xcrun simctl ui ${udid} appearance ${original.appearance}`)
    }
    for (const {key, value} of original.accessibility) {
      out.push(
        value === undefined
          ? `xcrun simctl spawn ${udid} defaults delete com.apple.Accessibility ${key}`
          : `xcrun simctl spawn ${udid} defaults write com.apple.Accessibility ${key} -bool ${value === '1' ? 'true' : 'false'}`
      )
    }
    // a relaunch drops the fixed Date and picks up the accessibility settings
    out.push(`xcrun simctl terminate ${udid} ${BUNDLE_ID}; xcrun simctl launch ${udid} ${BUNDLE_ID}`)
  }
  if (opts.appium) out.push(`kill $(lsof -t -iTCP:${opts.port} -sTCP:LISTEN)   # the gate's Appium`)
  return out
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
const SETUP_MS = 5_000
// Longer than a Pressable's 500ms long press delay.
const LONG_PRESS_S = 1

// The Duo's inner screen: XCUITest's presses land on the outer screen, and in Split View it cannot
// see the app's window, so a long-press there goes through duo-sim.m at this screen point: the target's
// centre in the app's window, plus where that window starts (the right half, in Split View right)
const innerTargets: ReadonlyArray<StoreTarget> = ['ios-duo-unfolded', 'ios-duo-split-left', 'ios-duo-split-right']
export const innerPressPoint = (
  box: {bottom: number; left: number; right: number; top: number},
  o: {target: StoreTarget; windowWidth: number; screenWidth: number}
) => ({
  x: (box.left + box.right) / 2 + (o.target === 'ios-duo-split-right' ? o.screenWidth - o.windowWidth : 0),
  y: (box.top + box.bottom) / 2,
})

export const appiumHome = () => process.env['APPIUM_HOME'] || `${homedir()}/.appium`
export const appiumPort = () => Number(process.env['KB_APPIUM_PORT'] ?? 4723)
// A non-default Appium port gets its own WDA port, so parallel
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
  // A run that exits before close (its overall deadline, a signal) would otherwise orphan Appium.
  const killOnExit = () => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
  }
  process.on('exit', killOnExit)
  child.once('exit', () => process.off('exit', killOnExit))
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


export type IosSession = NativeSession

// `target`: the store target the session captures for (an iPhone Duo's posture)
export async function openIos(opts: {device: string; target?: StoreTarget}): Promise<IosSession> {
  const {device, target} = opts
  const udid = iosUdid(device)
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
        // Helpers rely on $() taking the first match.
        strictSelectors: false,
      }),
      SESSION_MS,
      'starting the Appium session'
    )
  } catch (e) {
    await stopAppium(appium)
    throw e
  }
  const appCmd = async <R,>(p: Promise<R>, what: string) => withDeadline(p, APP_CMD_MS, what)
  const byTestID = (id: string) => browser.$(`~${id}`)

  // Appium's screenshot is always a Duo's outer screen, so a Duo is captured through simctl, on the
  // screen lit at the first capture (the run's posture is applied after the session opens)
  let duoDisplay: number | undefined | null = null
  const screenshot = async () => {
    if (duoDisplay === null) duoDisplay = screenshotDisplayOf(udid)
    return duoDisplay === undefined
      ? Buffer.from(await browser.takeScreenshot(), 'base64')
      : simctlScreenshot(udid, duoDisplay)
  }

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

  // what prepareDevice found, so restoreDevice can put it back
  let original: IosOriginal | undefined

  const dev: NativeDevice = {
    appId: BUNDLE_ID,
    appPid: () => {
      try {
        return pidFromLaunchctl(simctl('spawn', udid, 'launchctl', 'list'), BUNDLE_ID)
      } catch {
        return undefined
      }
    },
    cleanupCommands: () => iosCleanupCommands({appium: appium.exitCode === null && appium.signalCode === null, original, port, udid}),
    click: async testID => byTestID(testID).click(),
    // simctl and Appium screenshots are never blanked by the app
    checkCapture: () => {},
    // an upward swipe from the bottom edge
    dismissSystemUi: async () => {
      const {height, width} = await browser.getWindowRect()
      const x = Math.round(width / 2)
      await browser.action('pointer').move({x, y: height - 5}).down().move({duration: 300, x, y: Math.round(height * 0.2)}).up().perform()
    },
    end: async () => {
      await withDeadline(browser.deleteSession(), APP_CMD_MS, 'ending the Appium session').catch(() => {})
      await stopAppium(appium)
    },
    inspectorDevice: device,
    longPress: async (_testID, box, h) => {
      if (target && innerTargets.includes(target)) {
        const dims = await h.appEval<{screen: number; window: number}>(
          `const m = kbModule('node_modules/react-native/Libraries/Utilities/Dimensions.js')
           const D = m.default ?? m
           return {screen: D.get('screen').width, window: D.get('window').width}`,
          'reading the window size'
        )
        const p = innerPressPoint(box, {screenWidth: dims.screen, target, windowWidth: dims.window})
        touchInner(udid, [
          {...p, ms: 0},
          {...p, ms: LONG_PRESS_S * 1000},
        ])
        return
      }
      const at = {x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2}
      await browser.execute('mobile: touchAndHold', {...at, duration: LONG_PRESS_S})
    },
    // `$$` also finds elements on screens stacked under the current one and rows scrolled out of
    // view; only displayed elements inside the window mask, so a hidden one can't hide a visible region.
    maskRects: async entry => {
      const s = await screenScale()
      const win = await withDeadline(browser.getWindowRect(), SETUP_MS, 'window rect')
      const rects: Array<Rect> = []
      for (const m of entry.masks ?? []) {
        const all = await withDeadline(Promise.resolve(browser.$$(`~${m.testID}`).getElements()), SETUP_MS, `finding mask ${m.testID}`)
        const found: Array<Rect> = []
        for (const e of all) {
          const shown = await withDeadline(browser.isElementDisplayed(e.elementId), SETUP_MS, `is ${m.testID} displayed`)
          if (!shown) continue
          found.push(await withDeadline(browser.getElementRect(e.elementId), SETUP_MS, `rect of ${m.testID}`))
        }
        const visible = clipToWindow(found, win)
        if (visible.length === 0) throw new Error(`mask target ${m.testID} is not on screen (${all.length} found, none displayed in the window)`)
        rects.push(...visible.map(r => ({height: r.height * s, width: r.width * s, x: r.x * s, y: r.y * s})))
      }
      return rects
    },
    prepareRuntime: async () => Promise.resolve(),
    prepareDevice: () => {
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
      return changed
    },
    reduceTransparency: true,
    relaunch: async () => {
      await appCmd(browser.terminateApp(BUNDLE_ID), 'terminating the app')
      await appCmd(browser.activateApp(BUNDLE_ID), 'activating the app')
    },
    // The running app keeps Reduce Motion and Reduce Transparency on until its next launch: both
    // are read at startup.
    restoreDevice: () => {
      const quiet = (f: () => unknown) => {
        try {
          f()
        } catch {}
      }
      quiet(() => simctl('status_bar', udid, 'clear'))
      if (!original) return
      const {accessibility, appearance} = original
      if (appearance === 'light' || appearance === 'dark') quiet(() => simctl('ui', udid, 'appearance', appearance))
      for (const {key, value} of accessibility) {
        quiet(() =>
          value === undefined
            ? accessibilityDefaults(udid, key, 'delete')
            : accessibilityDefaults(udid, key, 'write', '-bool', value === '1' ? 'true' : 'false')
        )
      }
    },
    screenshot,
    scrollOther: async testID => {
      const elementId = await withDeadline(byTestID(testID).elementId, SETUP_MS, `finding ${testID}`)
      await browser.execute('mobile: scroll', {elementId, toVisible: true})
    },
    // Exists, not displayed: XCUITest reports a container view that holds other elements (most
    // screen roots) as not visible.
    waitForExist: async (testID, timeoutMs) => {
      await byTestID(testID).waitForExist({
        interval: 150,
        timeout: timeoutMs,
        timeoutMsg: `testID ${testID} did not appear after ${timeoutMs / 1000}s`,
      })
    },
  }
  return openNative(dev)
}
