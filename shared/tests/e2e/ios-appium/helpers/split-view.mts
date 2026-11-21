// Putting the app into Split View on an iPhone Duo's inner screen, left or right, the way a person
// does: from the inner Home Screen, a long-press on an app icon and "Open in Split View", then the
// other app picked on the other half. XCUITest reaches neither the inner Home Screen nor its touches,
// so this reads simctl screenshots (split-view-lib.mts) and touches through duo-sim.m; the second app
// is launched into the waiting half. Every touch follows a screenshot that shows what it is meant for;
// when one does not, it stops and touches nothing more. The app is never touched here by coordinates:
// the flows drive it through Appium.
import {execFileSync} from 'child_process'
import * as fs from 'fs'
import {createRequire} from 'module'
import * as path from 'path'
import {fileURLToPath} from 'url'
import {evalInPage, inspectorPageFor} from '../../shared/metro-eval.ts'
import {readFormFactor, screenshotDisplayOf, setPosture, simctlScreenshot, touchInner, type FormFactor, type Posture, type TouchPoint} from './form-factor.mts'
import {findBlueIcon, findIcon, findSplitViewRow, hasSplitDivider, isSplitWidth, type Img, type MenuLayout, type Point} from './split-view-lib.mts'

export type SplitSide = 'left' | 'right'

const BUNDLE_ID = 'keybase.ios'
const SAFARI = 'com.apple.mobilesafari'
// the inner screen's width in landscape, in points; the Home Screen of a split is its right half
const INNER_WIDTH = 951

export type SplitDeps = {
  // the inner screen
  screenshot: () => Promise<Img>
  touch: (points: ReadonlyArray<TouchPoint>) => void
  terminate: (bundleId: string) => void
  launch: (bundleId: string) => void
  // whether the app's window is half the screen, from the app itself
  appIsSplit: () => Promise<boolean>
  sleep: (ms: number) => Promise<void>
  find: {
    icon: (screen: Img) => Point | undefined
    blue: (screen: Img) => Point | undefined
    row: (screen: Img, at: Point, layout: MenuLayout, before: Img) => Point | undefined
    divider: (screen: Img) => boolean
  }
}

const LONG_PRESS: ReadonlyArray<number> = [0, 1000]
const longPress = (at: Point): Array<TouchPoint> => LONG_PRESS.map(ms => ({...at, ms}))
const tap = (at: Point): Array<TouchPoint> => [
  {...at, ms: 0},
  {...at, ms: 80},
]

// to the next Home Screen page: across empty wallpaper below the icons, at most twice
const PAGE_SWIPE: ReadonlyArray<TouchPoint> = [
  {ms: 0, x: 700, y: 480},
  {ms: 300, x: 250, y: 480},
]
const MAX_PAGE_SWIPES = 2

const stop = (why: string) => new Error(`Split View: ${why}; nothing more was touched`)

// The Home Screen half of a split shows the app's icon on the right half of the screen
const onRight = (p: Point | undefined) => (p && p.x > INNER_WIDTH / 2 ? p : undefined)

export const enterSplit = async (side: SplitSide, d: SplitDeps) => {
  d.terminate(BUNDLE_ID)
  d.terminate(SAFARI)
  // the whole Home Screen, once a split an earlier run left (it outlives its apps for a moment) is gone
  let home: Img | undefined
  let keybase: Point | undefined
  let safari: Point | undefined
  let swipes = 0
  for (let i = 0; i < 5; i++) {
    await d.sleep(2000)
    const shot = await d.screenshot()
    keybase = d.find.icon(shot)
    safari = d.find.blue(shot)
    const whole = !d.find.divider(shot) && !!safari
    if (whole && keybase) {
      home = shot
      break
    }
    // a whole Home Screen on a page without the Keybase icon (a restart shows the first page): on to
    // the next page, swiped across wallpaper that holds nothing on either page
    if (whole && swipes < MAX_PAGE_SWIPES) {
      swipes++
      d.touch(PAGE_SWIPE)
    }
  }
  if (!home || !keybase || !safari) throw stop(`the inner Home Screen does not show ${keybase ? 'Safari in the dock' : 'the Keybase icon'}`)
  // the app opened first takes the left half: Keybase for left, Safari for right
  const first = side === 'left' ? keybase : safari
  d.touch(longPress(first))
  await d.sleep(1000)
  const menu = await d.screenshot()
  const row = d.find.row(menu, first, side === 'left' ? 'after-remove' : 'first', home)
  if (!row) throw stop(`no "Open in Split View" in the ${side === 'left' ? 'Keybase' : 'Safari'} icon menu`)
  d.touch(tap(row))
  // split, with the Home Screen on the right half waiting for the other app: the divider, and the
  // Keybase icon right of it (looked for a few times: the split animates in)
  let waiting = false
  for (let i = 0; i < 4 && !waiting; i++) {
    await d.sleep(2000)
    const half = await d.screenshot()
    waiting = !!(d.find.divider(half) && onRight(d.find.icon(half)))
  }
  if (!waiting) throw stop(`the ${side === 'left' ? 'Keybase' : 'Safari'} app did not take the left half`)
  // launched rather than tapped: a launch fills the waiting half, with no touch to miss
  d.launch(side === 'left' ? SAFARI : BUNDLE_ID)
  if (!(await splitWithin(d))) throw stop('the app is not in Split View after the setup')
}

// Whether the app shows Split View within a minute (asked every 2s; an app still loading its bundle
// from Metro answers nothing)
const splitWithin = async (d: SplitDeps) => {
  for (let i = 0; i < 30; i++) {
    if (await d.appIsSplit().catch(() => false)) return true
    await d.sleep(2000)
  }
  return false
}

// Back to the app alone on the screen: both apps closed, the app launched again
export const leaveSplit = async (d: Pick<SplitDeps, 'launch' | 'sleep' | 'terminate'>) => {
  d.terminate(BUNDLE_ID)
  d.terminate(SAFARI)
  await d.sleep(1000)
  d.launch(BUNDLE_ID)
  await d.sleep(4000)
}

// ---------------------------------------------------------------- the real device

const require = createRequire(import.meta.url)
const {PNG} = require('pngjs') as {PNG: {sync: {read: (b: Buffer) => Img}}}
const APP_ICON = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../ios/Keybase/Images.xcassets/AppIcon.appiconset/keybase-icon-light.png')

const simctl = (args: ReadonlyArray<string>) =>
  execFileSync('xcrun', ['simctl', ...args], {encoding: 'utf8', killSignal: 'SIGKILL', stdio: ['pipe', 'pipe', 'pipe'], timeout: 60_000})

// The app's window and screen widths, from the app (React Native's Dimensions) through Metro
export const appIsSplit = async (device: string) => {
  const page = await inspectorPageFor(device, BUNDLE_ID)
  const dims = await evalInPage<{window: number; screen: number}>(
    page,
    `const m = kbModule('node_modules/react-native/Libraries/Utilities/Dimensions.js')
    const D = m.default ?? m
    return {screen: D.get('screen').width, window: D.get('window').width}`
  )
  return isSplitWidth(dims.window, dims.screen)
}

export const realSplitDeps = (udid: string, device: string): SplitDeps => {
  const icon = PNG.sync.read(fs.readFileSync(APP_ICON))
  return {
    appIsSplit: async () => appIsSplit(device),
    find: {blue: findBlueIcon, divider: hasSplitDivider, icon: s => findIcon(s, icon), row: findSplitViewRow},
    launch: id => void simctl(['launch', udid, id]),
    screenshot: async () => {
      const display = screenshotDisplayOf(udid)
      if (display === undefined) throw new Error(`${device} is not an iPhone Duo`)
      return PNG.sync.read(await simctlScreenshot(udid, display))
    },
    sleep: async ms => new Promise(resolve => setTimeout(resolve, ms)),
    terminate: id => {
      try {
        simctl(['terminate', udid, id])
      } catch {
        // not running
      }
    },
    touch: points => touchInner(udid, points),
  }
}

export type AnyPosture = Posture | `split-${SplitSide}`

export const parseAnyPosture = (v: string | undefined): AnyPosture | undefined => {
  if (!v) return undefined
  if (v === 'folded' || v === 'unfolded' || v === 'split-left' || v === 'split-right') return v
  throw new Error(`the posture must be folded, unfolded, split-left or split-right, not ${v}`)
}

// The form factor a posture puts a Duo in, and back. WebDriverAgent's launch folds a Duo, so a run
// applies its posture after its Appium session opens, and takes its form factor from the posture.
export const postureFormFactor = (p: AnyPosture): FormFactor => `duo-${p}`
export const postureOfFormFactor = (f: FormFactor): AnyPosture | undefined => {
  const p = f.startsWith('duo-') ? f.slice(4) : ''
  return p === 'folded' || p === 'unfolded' || p === 'split-left' || p === 'split-right' ? p : undefined
}

// Puts the Duo in `posture` and returns the run's form factor. A split run is labeled by the side it
// set up (the device itself only says unfolded); an unfolded one first leaves any Split View an earlier
// run left, so its app has the whole screen.
export const applyPosture = async (udid: string, device: string, posture: AnyPosture): Promise<FormFactor> => {
  if (posture === 'folded') {
    setPosture(udid, 'folded')
    return readFormFactor(udid)
  }
  setPosture(udid, 'unfolded')
  const deps = realSplitDeps(udid, device)
  if (posture === 'unfolded') {
    if (await appIsSplit(device).catch(() => false)) await leaveSplit(deps)
    return readFormFactor(udid)
  }
  const side: SplitSide = posture === 'split-left' ? 'left' : 'right'
  await enterSplit(side, deps)
  return `duo-split-${side}`
}
