// The Android device for a capture session (driver-native.mts runs the app's half), all through
// adb: screencap for screenshots, `input` for taps at a view's rect (read from the app, in window
// points), System UI demo mode for the status bar, and the animation scales at 0 for reduced motion.
// The app is edge to edge, so window points times the pixel ratio are screen pixels.
import {execFileSync} from 'child_process'
import {homedir} from 'os'
import * as path from 'path'
import {waitFor} from './driver-desktop.mts'
import {clipToWindow, openNative, type AppHelpers, type Box, type NativeDevice, type NativeSession} from './driver-native.mts'
import {makePng, pngBuffer, readPngBuffer, type PNGData, type Rect} from './compare.mts'

export const PACKAGE = 'io.keybase.ossifrage'
// the launcher's start: `monkey -p` exits -5 without starting anything on API 36
const LAUNCH = ['am', 'start', '-a', 'android.intent.action.MAIN', '-c', 'android.intent.category.LAUNCHER', '-n', `${PACKAGE}/.MainActivity`]
const ADB_MS = 15_000
const SCREENCAP_BYTES = 64 * 1024 * 1024
// Longer than a Pressable's 500ms long press delay.
const LONG_PRESS_MS = 1_000
const PROTECT_MS = 3_000
// The app's tablet layout is an iPad's only, so an Android tablet runs the phone tour: it is kept
// apart from the phone's captures by the window's smallest width, Android's own tablet line.
const TABLET_MIN_DP = 600

export const adbPath = () =>
  path.join(process.env['ANDROID_HOME'] ?? process.env['ANDROID_SDK_ROOT'] ?? path.join(homedir(), 'Library/Android/sdk'), 'platform-tools', 'adb')

const adbRaw = (serial: string | undefined, args: ReadonlyArray<string>) =>
  execFileSync(adbPath(), [...(serial ? ['-s', serial] : []), ...args], {
    maxBuffer: SCREENCAP_BYTES,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: ADB_MS,
  })
const adb = (serial: string | undefined, ...args: Array<string>) => adbRaw(serial, args).toString('utf8').trim()

// The serials `adb devices` lists as ready.
export const parseAdbDevices = (out: string): Array<string> =>
  out
    .split('\n')
    .slice(1)
    .map(l => l.trim().split(/\s+/))
    .filter(([serial, state]) => !!serial && state === 'device')
    .map(([serial]) => serial!)

// KB_ANDROID_SERIAL, else the one device adb lists.
export const androidSerial = (): string => {
  const asked = process.env['KB_ANDROID_SERIAL']
  if (asked) return asked
  const serials = parseAdbDevices(adb(undefined, 'devices'))
  if (serials.length === 1) return serials[0]!
  throw new Error(
    serials.length
      ? `adb lists ${serials.length} devices (${serials.join(', ')}); set KB_ANDROID_SERIAL to the one to capture`
      : 'adb lists no device; start an emulator'
  )
}

// What React Native names the device to Metro's inspector (AndroidInfoHelpers.getFriendlyDeviceName).
export const friendlyDeviceName = (model: string, release: string, sdk: string) => `${model} - ${release} - API ${sdk}`

// `wm size` and `wm density` print the physical value and, when set, an override line, which wins.
export const parseWm = (out: string, key: 'size' | 'density'): string => {
  const lines = out.split('\n')
  const pick = (kind: string) => lines.find(l => l.startsWith(`${kind} ${key}:`))?.split(':')[1]?.trim()
  const v = pick('Override') ?? pick('Physical')
  if (!v) throw new Error(`no ${key} in: ${out}`)
  return v
}

export type AndroidFormFactor = 'phone' | 'tablet'
export const androidFormFactor = (size: string, density: string): AndroidFormFactor => {
  const [w, h] = size.split('x').map(Number)
  const dpi = Number(density)
  if (!w || !h || !dpi) throw new Error(`cannot read the screen from size ${size}, density ${density}`)
  return (Math.min(w, h) * 160) / dpi >= TABLET_MIN_DP ? 'tablet' : 'phone'
}
export const readAndroidFormFactor = (serial: string) =>
  androidFormFactor(parseWm(adb(serial, 'shell', 'wm', 'size'), 'size'), parseWm(adb(serial, 'shell', 'wm', 'density'), 'density'))

// The animation scales a run sets to 0: React Native's AccessibilityInfo and Reanimated read reduced
// motion from them, and the system's own transitions stop.
export const ANIMATION_SCALES: ReadonlyArray<string> = ['animator_duration_scale', 'transition_animation_scale', 'window_animation_scale']

// System UI demo mode: 9:41, full wifi and cell bars, a full battery, no notification icons.
export const DEMO_COMMANDS: ReadonlyArray<ReadonlyArray<string>> = [
  ['enter'],
  ['clock', '-e', 'hhmm', '0941'],
  ['battery', '-e', 'level', '100', '-e', 'plugged', 'false', '-e', 'powersave', 'false'],
  ['network', '-e', 'wifi', 'show', '-e', 'level', '4', '-e', 'fully', 'true'],
  ['network', '-e', 'mobile', 'show', '-e', 'datatype', 'none', '-e', 'level', '4', '-e', 'fully', 'true'],
  ['notifications', '-e', 'visible', 'false'],
]
const demoBroadcast = (command: ReadonlyArray<string>) => {
  const [name, ...extras] = command
  return ['shell', 'am', 'broadcast', '-a', 'com.android.systemui.demo', '-e', 'command', name!, ...extras]
}

// What prepareDevice found: each animation scale and the demo-mode switch as `settings get` printed
// them ('null' when unset), and the night mode `cmd uimode night` printed (yes, no, auto, custom).
export type AndroidOriginal = {scales: Array<{key: string; value: string}>; demoAllowed: string; night: string}

export const parseNightMode = (out: string) => out.replace(/^Night mode:\s*/i, '').trim()

const restoreSetting = (key: string, value: string): Array<string> =>
  value === 'null' ? ['shell', 'settings', 'delete', 'global', key] : ['shell', 'settings', 'put', 'global', key, value]

export const androidRestoreSteps = (original: AndroidOriginal): Array<Array<string>> => [
  demoBroadcast(['exit']),
  restoreSetting('sysui_demo_allowed', original.demoAllowed),
  ...(['yes', 'no', 'auto'].includes(original.night) ? [['shell', 'cmd', 'uimode', 'night', original.night]] : []),
  ...original.scales.map(({key, value}) => restoreSetting(key, value)),
]

export const androidCleanupCommands = (serial: string, original: AndroidOriginal | undefined): Array<string> => {
  if (!original) return []
  const q = (a: string) => (/^[\w.:/=-]+$/.test(a) ? a : `'${a}'`)
  return [
    ...androidRestoreSteps(original).map(step => `adb -s ${serial} ${step.map(q).join(' ')}`),
    // a relaunch drops the fixed Date and reads the animation scales again
    ...relaunchCommands(serial),
  ]
}

// The point in screen pixels at the centre of a rect in window points.
export const centrePx = (box: Box, ratio: number) => ({
  x: Math.round(((box.left + box.right) / 2) * ratio),
  y: Math.round(((box.top + box.bottom) / 2) * ratio),
})

export const androidInspectorDevice = (serial: string) => {
  const sh = (...args: Array<string>) => adb(serial, 'shell', ...args)
  return friendlyDeviceName(sh('getprop', 'ro.product.model'), sh('getprop', 'ro.build.version.release'), sh('getprop', 'ro.build.version.sdk'))
}

export const relaunchCommands = (serial: string) => [
  `adb -s ${serial} shell am force-stop ${PACKAGE}`,
  `adb -s ${serial} reverse tcp:8081 tcp:8081`,
  `adb -s ${serial} shell ${LAUNCH.join(' ')}`,
]

// Force-stop, then a launcher start: the launcher intent starts the app cold, as a person would. The
// debug app loads its bundle from Metro on the host, through the reverse port.
export const relaunchAndroid = (serial: string) => {
  adb(serial, 'shell', 'am', 'force-stop', PACKAGE)
  adb(serial, 'reverse', 'tcp:8081', 'tcp:8081')
  adb(serial, 'shell', ...LAUNCH)
}

// Whether the app's part of a screenshot is all black, as Android draws a secure window: the middle
// of the screen, clear of the status and navigation bars the system still draws.
export const appAreaBlank = (png: PNGData) => {
  const y0 = Math.floor(png.height * 0.15)
  const y1 = Math.ceil(png.height * 0.85)
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4
      if (png.data[i]! > 8 || png.data[i + 1]! > 8 || png.data[i + 2]! > 8) return false
    }
  }
  return true
}

const SCREEN_CAPTURE = `const m = kbModule('node_modules/expo-screen-capture/build/ScreenCapture.js')`

// What a screencap of a secure window gives: Android 14 and later draw it black; Android 12 refuses
// the capture and prints nothing.
export type ProtectedShot = {kind: 'blank'; png: Buffer} | {kind: 'refused'} | {kind: 'shows'}
export const judgeProtectedShot = (raw: Buffer): ProtectedShot =>
  raw.length === 0 ? {kind: 'refused'} : appAreaBlank(readPngBuffer(raw)) ? {kind: 'blank', png: raw} : {kind: 'shows'}

// The centre of the part of a rect that is in the window, or undefined when none of it is.
export const visibleCentre = (box: Box, win: {width: number; height: number}) => {
  const [v] = clipToWindow([{height: box.bottom - box.top, width: box.right - box.left, x: box.left, y: box.top}], win)
  return v && {bottom: v.y + v.height, left: v.x, right: v.x + v.width, top: v.y}
}

export type AndroidSession = NativeSession

export function openAndroid(opts: {serial: string}): AndroidSession {
  const {serial} = opts
  const sh = (...args: Array<string>) => adb(serial, 'shell', ...args)
  const inspectorDevice = androidInspectorDevice(serial)
  adb(serial, 'reverse', 'tcp:8081', 'tcp:8081')

  let ratio: number | undefined
  const pixelRatio = async (h: AppHelpers) => {
    ratio ??= await h.appEval<number>(
      `const m = kbModule('node_modules/react-native/Libraries/Utilities/PixelRatio.js')
       return (m.default ?? m).get()`,
      'reading the pixel ratio'
    )
    return ratio
  }
  let win: {width: number; height: number} | undefined
  const windowSize = async (h: AppHelpers) => {
    win ??= await h.appEval<{width: number; height: number}>(
      `const m = kbModule('node_modules/react-native/Libraries/Utilities/Dimensions.js')
       const w = (m.default ?? m).get('window')
       return {height: w.height, width: w.width}`,
      'reading the window size'
    )
    return win
  }
  // the centre of the part of a view that is in the window, in screen pixels, as a tap by element
  // presses it
  const pointOf = async (testID: string, h: AppHelpers) => {
    await h.waitForTarget(testID)
    const box = await h.targetBox(testID)
    if (!box) throw new Error(`${testID}: it went before it could be pressed`)
    const shown = visibleCentre(box, await windowSize(h))
    if (!shown) throw new Error(`${testID}: none of it is in the window; scroll it into view first`)
    return centrePx(shown, await pixelRatio(h))
  }
  const screencap = () => adbRaw(serial, ['exec-out', 'screencap', '-p'])

  let original: AndroidOriginal | undefined

  const dev: NativeDevice = {
    appId: PACKAGE,
    appPid: () => {
      try {
        const pid = Number(sh('pidof', PACKAGE).split(/\s+/)[0])
        return pid > 0 ? pid : undefined
      } catch {
        return undefined
      }
    },
    cleanupCommands: prepared => (prepared ? androidCleanupCommands(serial, original) : []),
    // Turns the protector on as the app does, captures, and puts the run's lifted state back. The
    // window's secure flag takes a frame to reach the compositor, so the capture is retried briefly.
    // A device that refuses the capture has no image to show, so the card gets a black frame of the
    // screen's size and a note that says so.
    captureProtected: async h => {
      const size = readPngBuffer(screencap())
      await h.appEval(`${SCREEN_CAPTURE}\n return m.preventScreenCaptureAsync('screenprotector')`, 'turning the screen protector on')
      try {
        let shot: ProtectedShot = {kind: 'shows'}
        try {
          await waitFor('the screen protector to blank the screen', PROTECT_MS, async () => {
            shot = judgeProtectedShot(screencap())
            return Promise.resolve(shot.kind !== 'shows')
          })
        } catch {
          throw new Error('the screen protector is on but the app still shows in a screenshot')
        }
        const s = shot as ProtectedShot
        if (s.kind === 'blank') return {png: s.png}
        const black = makePng(size.width, size.height)
        for (let i = 3; i < black.data.length; i += 4) black.data[i] = 255
        return {note: 'screencap refused the secure window (Android 12 does); the image is a stand-in black frame', png: pngBuffer(black)}
      } finally {
        await h.appEval(`${SCREEN_CAPTURE}\n return m.allowScreenCaptureAsync('screenprotector')`, 'allowing screen capture')
      }
    },
    checkCapture: png => {
      if (png.length === 0 || appAreaBlank(readPngBuffer(png))) {
        throw new Error('the capture is empty or black where the app should be: is the screen protector still on?')
      }
    },
    click: async (testID, h) => {
      const p = await pointOf(testID, h)
      sh('input', 'tap', String(p.x), String(p.y))
    },
    dismissSystemUi: async () => {
      sh('cmd', 'statusbar', 'collapse')
      return Promise.resolve()
    },
    end: async () => Promise.resolve(),
    inspectorDevice,
    longPress: async (_testID, box, h) => {
      const p = centrePx(box, await pixelRatio(h))
      sh('input', 'swipe', String(p.x), String(p.y), String(p.x), String(p.y), String(LONG_PRESS_MS))
    },
    maskRects: async (entry, h) => {
      const rects: Array<Rect> = []
      if (!entry.masks?.length) return rects
      const r = await pixelRatio(h)
      const w = await windowSize(h)
      for (const m of entry.masks) {
        const b = await h.targetBox(m.testID)
        const visible = b ? clipToWindow([{height: b.bottom - b.top, width: b.right - b.left, x: b.left, y: b.top}], w) : []
        if (!visible.length) throw new Error(`mask target ${m.testID} is not on screen`)
        rects.push(...visible.map(v => ({height: v.height * r, width: v.width * r, x: v.x * r, y: v.y * r})))
      }
      return rects
    },
    prepareDevice: () => {
      original ??= {
        demoAllowed: sh('settings', 'get', 'global', 'sysui_demo_allowed'),
        night: parseNightMode(sh('cmd', 'uimode', 'night')),
        scales: ANIMATION_SCALES.map(key => ({key, value: sh('settings', 'get', 'global', key)})),
      }
      sh('settings', 'put', 'global', 'sysui_demo_allowed', '1')
      for (const c of DEMO_COMMANDS) adbRaw(serial, demoBroadcast(c))
      sh('cmd', 'uimode', 'night', 'no')
      // Reanimated reads reduced motion when its native module starts, so a change takes a relaunch
      let changed = false
      for (const key of ANIMATION_SCALES) {
        if (Number(sh('settings', 'get', 'global', key)) !== 0) {
          sh('settings', 'put', 'global', key, '0')
          changed = true
        }
      }
      return changed
    },
    // The screen protector (on by default) marks the window secure, which makes every screencap
    // black. It is lifted for this JS runtime only, never in the saved setting: the reload that
    // ends the session (or any relaunch) applies the saved setting again.
    prepareRuntime: async h => {
      await h.appEval(`${SCREEN_CAPTURE}\n return m.allowScreenCaptureAsync('screenprotector')`, 'allowing screen capture')
    },
    reduceTransparency: false,
    relaunch: async () => {
      relaunchAndroid(serial)
      return Promise.resolve()
    },
    restoreDevice: () => {
      if (!original) return
      for (const step of androidRestoreSteps(original)) {
        try {
          adbRaw(serial, step)
        } catch {}
      }
    },
    screenshot: async () => Promise.resolve(screencap()),
    scrollOther: async testID => Promise.reject(new Error(`scrollIntoView ${testID}: it is in neither a list row nor a ScrollView, which Android scrolls only from JS`)),
    waitForExist: async (testID, timeoutMs, h) =>
      waitFor(`testID ${testID} to appear`, timeoutMs, async () => h.targetPresent(testID)),
  }
  return openNative(dev)
}
