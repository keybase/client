// Putting the app into Split View on an iPhone Duo's inner screen, left or right, the way a person
// does: from the inner Home Screen, a long-press on an app icon and "Open in Split View", then the
// other app picked on the other half. XCUITest reaches neither the inner Home Screen nor its touches,
// so this reads simctl screenshots (split-view-lib.mts) and touches through duo-sim.m. Every touch
// follows a screenshot that shows what it is meant for; when one does not, it stops and touches
// nothing more. The app is never touched here by coordinates: the flows drive it through Appium.
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

const stop = (why: string) => new Error(`Split View: ${why}; nothing more was touched`)

// The Home Screen half of a split shows the app's icon on the right half of the screen
const onRight = (p: Point | undefined) => (p && p.x > INNER_WIDTH / 2 ? p : undefined)

export const enterSplit = async (side: SplitSide, d: SplitDeps) => {
  d.terminate(BUNDLE_ID)
  d.terminate(SAFARI)
  await d.sleep(1500)
  const home = await d.screenshot()
  const keybase = d.find.icon(home)
  const safari = d.find.blue(home)
  if (!keybase || !safari) throw stop(`the inner Home Screen does not show ${keybase ? 'Safari in the dock' : 'the Keybase icon'}`)
  // the app opened first takes the left half: Keybase for left, Safari for right
  const first = side === 'left' ? keybase : safari
  d.touch(longPress(first))
  await d.sleep(1000)
  const menu = await d.screenshot()
  const row = d.find.row(menu, first, side === 'left' ? 'after-remove' : 'first', home)
  if (!row) throw stop(`no "Open in Split View" in the ${side === 'left' ? 'Keybase' : 'Safari'} icon menu`)
  d.touch(tap(row))
  await d.sleep(2000)
  const half = await d.screenshot()
  // split, with the Home Screen on the right half: the divider, and the Keybase icon right of it
  const homeOnRight = d.find.divider(half) && onRight(d.find.icon(half))
  const second = homeOnRight && (side === 'left' ? d.find.blue(half) : homeOnRight)
  if (!second) throw stop(`the ${side === 'left' ? 'Keybase' : 'Safari'} app did not take the left half`)
  d.touch(tap(second))
  // the app may start here, and load its bundle from Metro
  await d.sleep(side === 'right' ? 6000 : 3000)
  if (!(await d.appIsSplit())) throw stop('the app is not in Split View after the setup')
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
