// Helpers for the iOS share-source matrix (share.test.ts): seed a source app with a file, bring up its
// share sheet, tap Keybase, then check what the share extension wrote and what the app sent.
//
// Ground truth comes from three places, never from screenshots:
// - the extension's manifest.json in the app group (the items it handed the app);
// - the app's JS state through Metro (the visible screen and its params, the thread store);
// - the simulator's unified log for the extension (its share-ext lines and any errors).
import {execFileSync} from 'child_process'
import * as fs from 'fs'
import * as http from 'http'
import * as os from 'os'
import * as path from 'path'
import * as T from '../../shared/test-ids'
import {jsEval, signedInAs, threadStoreBody} from './chat'
import {el} from './elements'
import {
  BUNDLE_ID,
  appSnapshot,
  deviceUdid,
  openSelfConversation,
  openUrl,
  selfConversationID,
  simctl,
  waitFor,
} from './lifecycle'
import {escapeToTabs, navigateToChat} from './navigate'

export const PHOTOS = 'com.apple.mobileslideshow'
export const FILES = 'com.apple.DocumentsApp'
export const SAFARI = 'com.apple.mobilesafari'
export const CONTACTS = 'com.apple.MobileAddressBook'
export const MAPS = 'com.apple.Maps'

const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const pred = (p: string) => browser.$(`-ios predicate string:${p}`)
const quote = (s: string) => JSON.stringify(s)

// -- assets ------------------------------------------------------------------------------------

// Written by share/make-assets.sh; run-ios-share.sh points KB_SHARE_ASSETS at them.
export const assetsDir = () => {
  const dir = process.env['KB_SHARE_ASSETS']
  if (!dir) throw new Error('KB_SHARE_ASSETS is unset: run tests/e2e/run-ios-share.sh, or make-assets.sh and export it')
  return dir
}
export const asset = (name: string) => path.join(assetsDir(), name)
// The name of the first missing asset (an optional tool was absent when they were made), if any.
export const missingAsset = (...names: Array<string>) => names.find(n => !fs.existsSync(asset(n)))

export type ServedRequest = {method: string; path: string; userAgent: string}

// Serves the assets to Safari on the loopback interface only; the simulator shares the host's. Every
// request is recorded, so a source can check what the share extension fetched.
export const startAssetServer = async () => {
  const requests: Array<ServedRequest> = []
  const types: Record<string, string> = {
    '.avif': 'image/avif',
    '.html': 'text/html',
    '.jpg': 'image/jpeg',
    '.mp4': 'video/mp4',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.webp': 'image/webp',
  }
  const server = http.createServer((req, res) => {
    requests.push({method: req.method ?? '', path: req.url ?? '', userAgent: req.headers['user-agent'] ?? ''})
    const name = path.basename(decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/'))
    const file = asset(name)
    if (!name || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, {
      'Content-Length': fs.statSync(file).size,
      'Content-Type': types[path.extname(name).toLowerCase()] ?? 'application/octet-stream',
    })
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    fs.createReadStream(file).pipe(res)
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('asset server has no port')
  return {close: () => server.close(), origin: `http://127.0.0.1:${address.port}`, requests}
}

// The requests the share extension made itself (its probes and downloads); Safari's own preview
// fetches are not the extension's.
export const extensionRequests = (requests: ReadonlyArray<ServedRequest>, since: number) =>
  requests.slice(since).filter(r => /KeybaseShare/i.test(r.userAgent))

// -- the simulator's containers ------------------------------------------------------------------

const groupContainer = (bundleId: string, group: string) => {
  const line = simctl('get_app_container', deviceUdid(), bundleId, 'groups')
    .split('\n')
    .find(l => l.startsWith(`${group}\t`))
  if (!line) {
    throw new Error(
      `${bundleId} has no ${group} container: a build installed without signing (CODE_SIGNING_ALLOWED=NO) has no app group, and installing one deletes the group's data`
    )
  }
  return line.slice(group.length + 1).trim()
}

export const incomingShareDir = () =>
  path.join(groupContainer(BUNDLE_ID, 'group.keybase'), 'Library', 'Caches', 'incoming-shares')

export type ManifestItem = {type?: string; originalPath?: string; content?: string; error?: string}

export const readManifest = (): Array<ManifestItem> | undefined => {
  try {
    return JSON.parse(fs.readFileSync(path.join(incomingShareDir(), 'manifest.json'), 'utf8')) as Array<ManifestItem>
  } catch {
    return undefined
  }
}

// So a manifest left by an earlier share can't pass for this one's.
export const removeManifest = () => fs.rmSync(path.join(incomingShareDir(), 'manifest.json'), {force: true})

// Media goes into Photos as the newest items, so the flows select from the end of the grid. A format
// Photos refuses skips the source.
export const addMedia = (ctx: Mocha.Context, ...names: Array<string>) => {
  // Photos dates an item without a capture date by its file's dates, so fresh copies sort newest.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-share-media-'))
  const files = names.map(n => {
    const f = path.join(dir, n)
    fs.copyFileSync(asset(n), f)
    const now = new Date()
    fs.utimesSync(f, now, now)
    return f
  })
  try {
    simctl('addmedia', deviceUdid(), ...files)
  } catch (e) {
    const detail = e instanceof Error ? e.message.split('\n').slice(-2).join(' ').trim() : String(e)
    skipSource(ctx, `the simulator's Photos refused ${names.join(', ')} (simctl addmedia: ${detail})`)
  } finally {
    fs.rmSync(dir, {force: true, recursive: true})
  }
}

// The Files app's "On My iPhone" storage. A folder there opens in Files from a shareddocuments: link.
export const seedFilesFolder = (folder: string, names: Array<string>) => {
  const dir = path.join(
    groupContainer(FILES, 'group.com.apple.FileProvider.LocalStorage'),
    'File Provider Storage',
    folder
  )
  fs.rmSync(dir, {force: true, recursive: true})
  fs.mkdirSync(dir, {recursive: true})
  for (const n of names) fs.copyFileSync(asset(n), path.join(dir, n))
  return dir
}

// -- other apps ---------------------------------------------------------------------------------

export const appState = async (bundleId: string) => Number(await browser.execute('mobile: queryAppState', {bundleId}))
const FOREGROUND = 4

// Runs fn with element lookups pointed at another app, freshly launched so it starts at its root.
export const inApp = async <R>(bundleId: string, fn: () => Promise<R>, {fresh = true} = {}): Promise<R> => {
  if (fresh) await browser.execute('mobile: terminateApp', {bundleId}).catch(() => {})
  await browser.execute('mobile: activateApp', {bundleId})
  await browser.updateSettings({defaultActiveApplication: bundleId})
  try {
    return await fn()
  } finally {
    await browser.updateSettings({defaultActiveApplication: BUNDLE_ID})
  }
}

// System prompts (location, notifications) belong to SpringBoard; a first launch of Maps raises one.
export const dismissSystemPrompts = async (host: string) => {
  await browser.updateSettings({defaultActiveApplication: 'com.apple.springboard'})
  try {
    const deny = pred('type == "XCUIElementTypeButton" AND (label BEGINSWITH "Don" OR label == "Not Now")')
    if (await deny.isExisting()) await deny.click()
  } finally {
    await browser.updateSettings({defaultActiveApplication: host})
  }
}

export const tapWhenExists = async (p: string, timeout = 10_000) => {
  const e = pred(p)
  await e.waitForExist({interval: 200, timeout, timeoutMsg: `never found: ${p}`})
  await e.click()
}
export const exists = async (p: string, timeout = 0) =>
  timeout ? pred(p).waitForExist({interval: 200, timeout}).then(() => true, () => false) : pred(p).isExisting()

const touchAndHold = async (p: string) => {
  await pred(p).waitForExist({interval: 200, timeout: 10_000, timeoutMsg: `never found: ${p}`})
  const e = await pred(p).getElement()
  await browser.execute('mobile: touchAndHold', {duration: 1.2, elementId: e.elementId})
}

// Photos: the newest `count` items of the library grid, shared together.
const photosGrid = async (count: number) =>
  waitFor(
    `${count} items in the Photos grid`,
    async () => {
      const cells = await browser.$$('-ios predicate string:name == "PXGGridLayout-Info"').getElements()
      return cells.length >= count ? cells : undefined
    },
    {interval: 500, timeout: 20_000}
  )

// Photos reopens where it was left, often a single photo or the edit screen; back out to the grid.
const photosToGrid = async () => {
  for (let i = 0; i < 4; i++) {
    const back = [
      'name == "PUOneUpBarButtonItemIdentifierDone"',
      'name == "header.closeButton"',
      'type == "XCUIElementTypeButton" AND label == "Cancel"',
      'type == "XCUIElementTypeButton" AND label CONTAINS "Discard"',
    ]
    let found = false
    for (const b of back) {
      if (await exists(b)) {
        await tapWhenExists(b)
        await sleep(800)
        found = true
        break
      }
    }
    if (!found) break
  }
  // An item's capture date can be anything (a video carries its own), so the newest by import are
  // only at the end of the grid when it is sorted by when they were added.
  await waitFor(
    'the grid sorted by Recently Added',
    async () => {
      await tapWhenExists('name == "sortFilterButton"')
      await tapWhenExists('type == "XCUIElementTypeButton" AND label == "Sort by Recently Added"', 3000)
      return true
    },
    {interval: 1000, timeout: 20_000}
  )
  await sleep(800)
  // choosing the sort it already has leaves the menu open over the grid
  const menuOpen = 'label == "Sort by Date Captured" AND visible == 1'
  for (let i = 0; i < 3 && (await exists(menuOpen)); i++) {
    await tapWhenExists('name == "sortFilterButton"')
    await sleep(800)
  }
  if (await browser.isKeyboardShown().catch(() => false)) await browser.execute('mobile: hideKeyboard').catch(() => {})
}

export const sharePhotosSheet = (count: number) => async () => {
  await photosToGrid()
  const cells = await photosGrid(count)
  const newest = cells.slice(-count)
  if (count === 1) {
    const share = 'name == "PUOneUpBarButtonItemIdentifierShare"'
    await waitFor(
      'the photo to open',
      async () => {
        if (await exists(share)) return true
        await newest[0]!.click().catch(() => {})
        return (await exists(share, 4000)) ? true : undefined
      },
      {interval: 500, timeout: 20_000}
    )
    await tapWhenExists(share)
    return
  }
  await tapWhenExists('type == "XCUIElementTypeButton" AND label == "Select"')
  for (const c of newest) {
    await c.click()
    await sleep(250)
  }
  await tapWhenExists('type == "XCUIElementTypeButton" AND label == "Share"')
}

// Photos: edits the newest `count` items (a 90° rotation, saved as an edit).
export const rotateNewestPhotos = async (count: number) => {
  await photosToGrid()
  for (let i = 1; i <= count; i++) {
    const cells = await photosGrid(i)
    await cells[cells.length - i]!.click()
    await tapWhenExists('name == "PUOneUpBarButtonItemIdentifierEdit"')
    // the editor loads after the Edit tap; its Done button is the sign it is ready
    await pred('type == "XCUIElementTypeButton" AND label == "Done"').waitForExist({
      interval: 250,
      timeout: 30_000,
      timeoutMsg: 'the Photos editor never loaded',
    })
    await tapWhenExists('type == "XCUIElementTypeButton" AND label == "Crop and Rotate"', 20_000)
    await tapWhenExists('type == "XCUIElementTypeButton" AND label == "Rotate"', 20_000)
    await tapWhenExists('type == "XCUIElementTypeButton" AND label == "Done"')
    // back in the one-up view once the edit is saved
    await pred('name == "PUOneUpBarButtonItemIdentifierDone"').waitForExist({interval: 250, timeout: 30_000})
    await sleep(1000)
    await tapWhenExists('name == "PUOneUpBarButtonItemIdentifierDone"')
    await sleep(1000)
  }
}

// Files: the named files in a seeded folder; one is shared from its context menu, several from
// selection mode.
export const shareFilesSheet = (dir: string, names: Array<string>) => async () => {
  openUrl(`shareddocuments://${encodeURI(dir)}`)
  // a cell is named "<name>, <extension>", where Files drops the extension from the name for the
  // types it knows (pdf, mp4, tif) and keeps it for the rest (zip, dat)
  const cell = (n: string) => {
    const ext = path.extname(n).slice(1)
    return `type == "XCUIElementTypeCell" AND (name == ${quote(`${path.basename(n, `.${ext}`)}, ${ext}`)} OR name == ${quote(`${n}, ${ext}`)})`
  }
  await pred(cell(names[0]!)).waitForExist({interval: 250, timeout: 15_000, timeoutMsg: `Files never showed ${names[0]}`})
  if (names.length === 1) {
    await touchAndHold(cell(names[0]!))
    await tapWhenExists('label == "Share" AND type == "XCUIElementTypeButton"')
    return
  }
  await tapWhenExists('name == "OverflowBarButtonItem"')
  await tapWhenExists('label == "Select"')
  for (const n of names) await tapWhenExists(cell(n))
  await tapWhenExists('type == "XCUIElementTypeButton" AND label == "Share"')
}

// Safari: the page at url, shared from the toolbar's More menu.
export const shareSafariPageSheet = (url: string, {settle = 2500} = {}) => async () => {
  openUrl(url)
  await sleep(settle)
  // A video opens full screen over the toolbar, and Safari restores the last one on relaunch. Its
  // controls hide themselves, so bring them up with a tap before tapping Close.
  if (await exists('name == "Close Button"')) {
    await waitFor(
      'the video to leave full screen',
      async () => {
        if (await exists('name == "MoreMenuButton" AND visible == 1')) return true
        const {height, width} = await browser.getWindowRect()
        await browser.execute('mobile: tap', {x: Math.round(width / 2), y: Math.round(height / 2)})
        await sleep(400)
        if (await exists('name == "Close Button"')) await pred('name == "Close Button"').click().catch(() => {})
        return undefined
      },
      {interval: 2500, timeout: 30_000}
    )
  }
  await tapWhenExists('name == "MoreMenuButton"', 15_000)
  await tapWhenExists('name == "ShareButton"')
}

// Safari: an image long-pressed (found by its alt text), or all the text of a text area (found by
// its label), shared from the menu that comes up.
export const shareSafariElementSheet = (url: string, element: string, {selectAll = false} = {}) => async () => {
  openUrl(url)
  await sleep(2500)
  const shareItem = 'label BEGINSWITH "Share" AND (type == "XCUIElementTypeButton" OR type == "XCUIElementTypeMenuItem" OR type == "XCUIElementTypeCell")'
  if (!selectAll) {
    await touchAndHold(`label == ${quote(element)}`)
    await tapWhenExists(shareItem)
    return
  }
  // the first tap focuses the text area, the second brings up its edit menu
  await tapWhenExists(`label == ${quote(element)}`)
  await sleep(800)
  await tapWhenExists(`label == ${quote(element)}`)
  await tapWhenExists('type == "XCUIElementTypeMenuItem" AND label == "Select All"')
  await sleep(800)
  // the edit menu pages its items behind a chevron
  for (let i = 0; i < 5 && !(await exists(shareItem)); i++) {
    await tapWhenExists('type == "XCUIElementTypeButton" AND label == "Forward"', 3000)
    await sleep(500)
  }
  await tapWhenExists(shareItem)
}

// Contacts: the seeded card, through Share Contact.
export const shareContactSheet = (name: string) => async () => {
  // Contacts reopens on the card it last showed
  if (!(await exists('type == "XCUIElementTypeButton" AND label == "Edit"', 3000))) {
    await tapWhenExists(`label CONTAINS ${quote(name)}`, 15_000)
  }
  for (let i = 0; i < 4 && !(await exists('label == "Share Contact"')); i++) {
    await browser.execute('mobile: swipe', {direction: 'up'})
  }
  await tapWhenExists('label == "Share Contact"')
  await tapWhenExists('type == "XCUIElementTypeButton" AND label == "Done"')
}

// Maps: a dropped pin's place card.
export const shareMapsPinSheet = (lat: number, lon: number, name: string) => async () => {
  openUrl(`maps://?ll=${lat},${lon}&q=${encodeURIComponent(name)}`)
  const share = 'name == "CardButtonTypeShare"'
  await waitFor(
    'the place card',
    async () => {
      if (await exists(share)) return true
      await dismissSystemPrompts(MAPS)
      for (const l of ['Not Now', 'Continue']) {
        if (await exists(`type == "XCUIElementTypeButton" AND label == ${quote(l)}`)) {
          await tapWhenExists(`type == "XCUIElementTypeButton" AND label == ${quote(l)}`)
        }
      }
      return undefined
    },
    {interval: 1000, timeout: 30_000}
  )
  await tapWhenExists(share)
}

// -- the share ------------------------------------------------------------------------------------

// iOS keeps a finished extension's process around for a while, so "running" means one that wasn't
// there before this share.
const extensionPids = () => {
  try {
    return execFileSync('pgrep', ['-x', 'KeybaseShare'], {encoding: 'utf8'}).split('\n').filter(Boolean)
  } catch {
    return []
  }
}

const logTime = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// The extension's own lines (Logger share-ext) and any error it or the system logged for it.
export const extensionLogSince = (since: Date) =>
  simctl(
    'spawn',
    deviceUdid(),
    'log',
    'show',
    '--start',
    logTime(since),
    '--style',
    'compact',
    '--predicate',
    '(subsystem == "com.keybase.app" AND category == "share-ext") OR (process == "KeybaseShare" AND (messageType == error OR messageType == fault))'
  )
    .split('\n')
    .filter(l => /share-ext|KeybaseShare/.test(l))

export type ShareOutcome = {
  appOpened: boolean
  extensionFinished: boolean
  extLog: Array<string>
  manifest?: Array<ManifestItem>
  // from the tap on Keybase to the app opening
  ms: number
}

export type SheetSource = {host: string; open: () => Promise<void>; fresh?: boolean}

// The suggested-conversation row the share sheet shows for a donated Keybase conversation.
export const suggestionRow = (name: string) =>
  `name != "shareCell" AND type == "XCUIElementTypeCell" AND (label == ${quote(name)} OR label BEGINSWITH ${quote(`${name}, `)})`

// Opens the host's share sheet and taps Keybase (or `target`, a suggestion row), then waits for the
// extension to exit and the app to come forward. A share that never finishes is stopped, so the next
// source starts clean.
export const shareToKeybase = async (
  source: SheetSource,
  {target = 'name == "shareCell" AND label == "Keybase"', timeout = 150_000} = {}
): Promise<ShareOutcome> => {
  removeManifest()
  const since = new Date(Date.now() - 1000)
  const before = new Set(extensionPids())
  const extensionRunning = () => extensionPids().some(p => !before.has(p))
  let t0 = 0
  await inApp(
    source.host,
    async () => {
      await source.open()
      await pred(target).waitForExist({interval: 200, timeout: 15_000, timeoutMsg: `the share sheet never showed ${target}`})
      // A sheet still loading its preview (a video) takes the tap without acting on it, so tap until
      // the extension starts.
      await sleep(1200)
      await waitFor(
        'the share extension to start',
        async () => {
          if (extensionRunning() || (await appState(BUNDLE_ID)) === FOREGROUND) return true
          if (await exists(target)) {
            t0 ||= Date.now()
            await pred(target).click().catch(() => {})
          }
          return undefined
        },
        {interval: 2500, timeout: 30_000}
      )
    },
    {fresh: source.fresh ?? true}
  )
  // the extension's watchdog gives up after 120s without progress
  const appOpened = await waitFor('the app to open', async () => ((await appState(BUNDLE_ID)) === FOREGROUND ? true : undefined), {
    interval: 300,
    timeout,
  }).catch(() => false)
  const ms = Date.now() - t0
  // The extension opens the app only after its alert is gone, right before it completes the request,
  // so an open app means it finished. Without one, it finished only if its process went away (a
  // cancelled share); iOS may keep a finished extension's process around for a while.
  const extensionFinished =
    appOpened ||
    (await waitFor('the share extension to exit', () => (extensionRunning() ? undefined : true), {
      interval: 300,
      timeout: 1_000,
    }).catch(() => false))
  if (!extensionFinished) {
    // only this share's extension: an older one may belong to a share still on screen. pgrep is
    // host-wide, so with two simulators booted this could also pick up the other one's extension.
    await browser.saveScreenshot(path.join(shareDebugDir(), `stuck-${Date.now()}.png`)).catch(() => {})
    for (const pid of extensionPids().filter(p => !before.has(p))) {
      try {
        execFileSync('kill', ['-9', pid])
      } catch {
        // already gone
      }
    }
  }
  await sleep(500)
  return {appOpened, extLog: extensionLogSince(since), extensionFinished, manifest: readManifest(), ms}
}

export const shareDebugDir = () => {
  const dir = process.env['KB_IOS_APPIUM_DEBUG_DIR'] ?? 'tests/results/ios-appium-share-iphone'
  fs.mkdirSync(dir, {recursive: true})
  return dir
}

// -- expectations ----------------------------------------------------------------------------------

export type ItemType = 'image' | 'video' | 'file' | 'text'
export type Expected = {
  // the manifest's items, one per shared item, in any order. A text item with a name is text too
  // long for one message, attached as a .txt.
  items: Array<{type: ItemType; name?: RegExp; content?: RegExp}>
  // what lands in the thread, when it differs from the items (transcoded names, text)
  delivered?: Array<{type: ItemType; name?: RegExp; text?: RegExp}>
  // a shared video's length, checked against the sent attachment's
  videoSeconds?: number
}

const matchAll = <I, E>(what: string, got: ReadonlyArray<I>, want: ReadonlyArray<E>, ok: (i: I, e: E) => boolean) => {
  const problems: Array<string> = []
  if (got.length !== want.length) problems.push(`${what}: ${got.length} items, expected ${want.length}`)
  const left = [...got]
  for (const e of want) {
    const i = left.findIndex(g => ok(g, e))
    if (i < 0) problems.push(`${what}: nothing matches ${JSON.stringify(e, (_k, v: unknown) => (v instanceof RegExp ? String(v) : v))}`)
    else left.splice(i, 1)
  }
  return problems
}

export const manifestProblems = (manifest: ReadonlyArray<ManifestItem> | undefined, expected: Expected) => {
  if (!manifest) return ['no manifest.json was written']
  const errors = manifest.filter(m => m.error).map(m => `manifest error item: ${m.error}`)
  const items = manifest.filter(m => !m.error)
  const paths = items.flatMap(m => (m.originalPath ? [m.originalPath] : []))
  if (new Set(paths).size !== paths.length) errors.push('two manifest items share one file')
  return [
    ...errors,
    ...matchAll('manifest', items, expected.items, (m, e) => {
      if (m.type !== e.type) return false
      if (e.name && !(m.originalPath && e.name.test(path.basename(m.originalPath)))) return false
      if (e.content && !(m.content && e.content.test(m.content))) return false
      if (m.originalPath && !fs.existsSync(m.originalPath)) return false
      return true
    }),
  ]
}

// -- the app side ---------------------------------------------------------------------------------

type Screen = {name?: string; params?: Record<string, unknown>}
const visibleScreen = async (): Promise<Screen | undefined> => (await appSnapshot()).screen
const waitForScreen = async (what: string, ok: (s: Screen) => boolean, timeout = 30_000) =>
  waitFor(what, async () => {
    const s = await visibleScreen()
    return s && ok(s) ? s : undefined
  }, {interval: 400, timeout})

// The app must be signed in as the smoke user before anything is sent.
export const requireSignedInAs = async (username: string) => {
  const a = await signedInAs()
  if (!a.loggedIn || a.switching || a.username !== username) {
    throw new Error(`the app is not signed in as the smoke user (signed in: ${a.loggedIn}, as "${a.username}"): stopped before sending`)
  }
}

// Picks the self conversation in the share screen's conversation picker by its exact name.
const pickSelfConversation = async (username: string) => {
  // The search box surfaces as a plain element ("<placeholder>, <clear>"), not a text field: tap it
  // and type into the focused input.
  await tapWhenExists('label CONTAINS "Search chats..." AND visible == 1', 15_000)
  await waitFor('the keyboard', async () => ((await browser.isKeyboardShown().catch(() => false)) ? true : undefined), {
    interval: 250,
    timeout: 10_000,
  })
  await browser.keys([...username])
  // A picker row is one element labelled with the conversation's name, as tall as a row; the search
  // box and the row's own text can carry the same label, so only row-sized ones count.
  const exact = `label == ${quote(username)} AND visible == 1`
  const rows = async () => {
    const out = []
    for (const e of await browser.$$(`-ios predicate string:${exact}`).getElements()) {
      if ((await e.getSize()).height >= 48) out.push(e)
    }
    return out
  }
  const row = await waitFor(
    `exactly one "${username}" conversation in the picker`,
    async () => {
      const found = await rows()
      if (found.length > 1) {
        fs.writeFileSync(path.join(shareDebugDir(), `picker-ambiguous-${Date.now()}.xml`), await browser.getPageSource())
        throw new Error(`${found.length} conversations are named "${username}"`)
      }
      return found[0]
    },
    {interval: 400, timeout: 20_000}
  )
  await row.click()
}

export type Delivered = {
  attachmentType?: string
  fileName?: string
  fileType?: string
  id: number
  submitState?: string
  text?: string
  title?: string
  transferState?: string
  type: string
  videoDuration?: string
}

// The smoke user's messages in the visible self conversation sent at or after `since`.
const sentSince = async (convID: string, username: string, since: number) =>
  jsEval<Array<Delivered> | null>(`${threadStoreBody}
    if (convID !== ${quote(convID)} || !st) return null
    const out = []
    for (const o of st.messageOrdinals || []) {
      const m = st.messageMap.get(o)
      if (!m || m.author !== ${quote(username)} || m.timestamp < ${since}) continue
      if (m.type !== 'attachment' && m.type !== 'text') continue
      out.push({
        attachmentType: m.attachmentType, fileName: m.fileName, fileType: m.fileType, id: m.id,
        submitState: m.submitState, text: m.text && m.text.stringValue ? m.text.stringValue() : undefined,
        title: m.title, transferState: m.transferState, type: m.type, videoDuration: m.videoDuration,
      })
    }
    return out
  `)

export type SendResult = {delivered: Array<Delivered>; destination: Screen}

// From the app's share screen: picks the self conversation (or checks the suggested one already
// picked), asserts the destination, sends, and waits for every message to be sent and uploaded.
export const sendToSelfConversation = async (
  username: string,
  convID: string,
  expected: Expected,
  {suggested = false} = {}
): Promise<SendResult> => {
  // text goes into the composer; text attached as a .txt goes through the send screen like a file
  const isText = expected.items.every(i => i.type === 'text' && !i.name)
  if (!suggested) {
    await waitForScreen('the share screen', s => s.name === 'incomingShareNew')
    await pickSelfConversation(username)
  }
  let destination: Screen
  if (isText) {
    // text goes into the thread's composer rather than a send screen
    destination = await waitForScreen('the self conversation', s => s.name === 'chatConversation')
  } else {
    destination = await waitForScreen('the send screen', s => s.name === 'chatAttachmentGetTitles')
  }
  if (destination.params?.['conversationIDKey'] !== convID) {
    throw new Error(`destination is ${String(destination.params?.['conversationIDKey'])}, not the self conversation: not sending`)
  }
  if (!isText && !suggested && destination.params['tlfName'] !== username) {
    throw new Error(`destination tlf is ${String(destination.params['tlfName'])}, not ${username}: not sending`)
  }
  await requireSignedInAs(username)
  const sentAt = Date.now() - 5_000
  if (isText) {
    await el(T.CHAT_SEND_BUTTON).waitForExist({interval: 250, timeout: 10_000, timeoutMsg: 'no send button: nothing in the composer'})
    await el(T.CHAT_SEND_BUTTON).click()
  } else {
    const all = 'type == "XCUIElementTypeButton" AND label == "Send All" AND visible == 1'
    await tapWhenExists((await exists(all, 1500)) ? all : 'type == "XCUIElementTypeButton" AND label == "Send" AND visible == 1')
    // the send screen stays up with an error banner when processing a file fails
    const end = Date.now() + 180_000
    for (;;) {
      const banner = pred('label CONTAINS "processing failed" AND visible == 1')
      if (await banner.isExisting()) throw new Error(`the send screen showed: ${await banner.getAttribute('label')}`)
      const s = await visibleScreen().catch(() => undefined)
      if (s?.name === 'chatConversation' && s.params?.['conversationIDKey'] === convID) break
      if (Date.now() > end) throw new Error('the app never returned to the self conversation after Send')
      await sleep(1000)
    }
  }
  const want = (expected.delivered ?? expected.items).length
  const delivered = await waitFor(
    `${want} sent message(s) in the self conversation`,
    async () => {
      const got = await sentSince(convID, username, sentAt)
      if (!got || got.length < want) return undefined
      const failed = got.find(m => m.submitState === 'failed')
      if (failed) throw new Error(`a message failed to send: ${JSON.stringify(failed)}`)
      return got.every(m => m.id > 0 && !m.submitState && !m.transferState) ? got : undefined
    },
    {interval: 1000, timeout: 300_000}
  )
  return {delivered, destination}
}

const deliveredType = (m: Delivered): ItemType =>
  m.type === 'text' ? 'text' : m.videoDuration ? 'video' : m.attachmentType === 'image' ? 'image' : 'file'

// "1:15, 54 MB" → 75
export const durationSeconds = (videoDuration?: string) => {
  const parts = /^(\d+(?::\d+)+)/.exec(videoDuration ?? '')?.[1]?.split(':').map(Number)
  return parts ? parts.reduce((t, p) => t * 60 + p, 0) : undefined
}

export const deliveryProblems = (delivered: ReadonlyArray<Delivered>, expected: Expected) => {
  // By default only a file keeps its name: the app re-encodes images to "<name>.compressed.jpg" and
  // videos to "<name>.processed.mp4" before sending.
  const want =
    expected.delivered ??
    expected.items.map(i => ({name: i.type === 'file' ? i.name : undefined, text: i.content, type: i.type}))
  const problems = matchAll('delivered', delivered, want, (m, e) => {
    if (deliveredType(m) !== e.type) return false
    if (e.name && !(m.fileName && e.name.test(m.fileName))) return false
    if (e.text && !(m.text && e.text.test(m.text))) return false
    return true
  })
  if (expected.videoSeconds !== undefined) {
    for (const m of delivered.filter(d => deliveredType(d) === 'video')) {
      const s = durationSeconds(m.videoDuration)
      if (s === undefined || Math.abs(s - expected.videoSeconds) > 1) {
        problems.push(`video "${m.fileName}" is ${m.videoDuration ?? 'unknown'} long, expected ${expected.videoSeconds}s`)
      }
    }
  }
  return problems
}

// Leaves the app's share picker through its own Cancel, if it is up. Never escapeToTabs from the
// picker: its taps can land on a conversation row, which picks that conversation and puts the shared
// text into its draft. Throws if the picker stays up, so the caller doesn't fall back to escaping.
export const leaveSharePicker = async () => {
  const cancel = 'type == "XCUIElementTypeButton" AND label == "Cancel" AND visible == 1'
  const onPicker = async () => (await visibleScreen().catch(() => undefined))?.name === 'incomingShareNew'
  for (let i = 0; i < 3 && (await onPicker()); i++) {
    if (await browser.isKeyboardShown().catch(() => false)) await browser.execute('mobile: hideKeyboard').catch(() => {})
    if (await exists(cancel, 3000)) await pred(cancel).click().catch(() => {})
    await sleep(1500)
  }
  if (await onPicker()) throw new Error("the share picker's Cancel never closed it")
}

// -- results ---------------------------------------------------------------------------------------

export type SourceResult = {
  source: string
  share?: ShareOutcome
  send?: SendResult
  problems: Array<string>
  skipped?: string
}

export const writeResult = (r: SourceResult) => {
  const slug = r.source.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')
  fs.writeFileSync(path.join(shareDebugDir(), `${slug}.result.json`), JSON.stringify(r, null, 2))
}

// Whether a run sends at all: KB_SHARE_NO_SEND=1 stops every source at the app's share screen.
export const sending = () => process.env['KB_SHARE_NO_SEND'] !== '1'

export const smokeUser = () => {
  const u = process.env['KB_SMOKE_USER']
  if (!u) throw new Error('KB_SMOKE_USER is unset')
  return u
}

let selfConv: Promise<string> | undefined
const selfConversation = async () => {
  selfConv ??= selfConversationID(smokeUser())
  return selfConv.catch((e: unknown) => {
    selfConv = undefined
    throw e
  })
}

// One source end to end: share, check the extension's result, then (unless sending is off) send
// into the self conversation and check what arrived. Writes the source's result json and throws
// with every problem found.
export const runSource = async (
  source: string,
  sheet: SheetSource,
  expected: Expected,
  // overShareScreen: share while an earlier share's picker is still up, to check this one replaces it
  opts: {target?: string; suggested?: boolean; keepShareScreen?: boolean; overShareScreen?: boolean} = {}
) => {
  const r: SourceResult = {problems: [], source}
  try {
    // With no conversation selected, an inbox layout update sends the phone back to the inbox and
    // takes the share screen down with it (see 'the share screen stays up over the inbox'), so the
    // other sources share from an open conversation.
    if (sending() && !opts.overShareScreen) {
      await browser.execute('mobile: activateApp', {bundleId: BUNDLE_ID})
      await leaveSharePicker()
      await openSelfConversation(smokeUser())
    }
    r.share = await shareToKeybase(sheet, {target: opts.target})
    if (!r.share.extensionFinished) r.problems.push('the share extension never finished')
    if (!r.share.appOpened) r.problems.push('the app never opened')
    r.problems.push(...manifestProblems(r.share.manifest, expected))
    const somethingShared = (r.share.manifest ?? []).some(m => !m.error)
    if (r.share.appOpened && somethingShared && !opts.keepShareScreen) {
      if (sending()) {
        r.send = await sendToSelfConversation(smokeUser(), await selfConversation(), expected, {suggested: opts.suggested})
        r.problems.push(...deliveryProblems(r.send.delivered, expected))
      } else {
        await waitForScreen('the share screen', s => s.name === 'incomingShareNew' || s.name === 'chatAttachmentGetTitles')
        await leaveSharePicker()
      }
    }
  } catch (e) {
    r.problems.push(e instanceof Error ? e.message : String(e))
  } finally {
    writeResult(r)
  }
  if (r.problems.length) throw new Error(r.problems.join('\n'))
  return r
}

// Shares from the inbox with no conversation open, and checks the share screen is still up after
// `seconds`, sampling the visible screen once a second. Returns when it went away, if it did.
export const shareScreenLifetime = async (sheet: SheetSource, seconds: number) => {
  await leaveSharePicker()
  await escapeToTabs()
  await navigateToChat()
  const r: SourceResult = {problems: [], source: 'share-screen-over-inbox'}
  try {
    r.share = await shareToKeybase(sheet)
    await waitForScreen('the share screen', s => s.name === 'incomingShareNew', 15_000)
    const start = Date.now()
    while (Date.now() - start < seconds * 1000) {
      const s = await visibleScreen()
      if (s?.name !== 'incomingShareNew') {
        r.problems.push(`the share screen closed by itself after ${((Date.now() - start) / 1000).toFixed(1)}s (now on ${s?.name ?? 'nothing'})`)
        break
      }
      await sleep(1000)
    }
    await leaveSharePicker()
  } catch (e) {
    r.problems.push(e instanceof Error ? e.message : String(e))
  } finally {
    writeResult(r)
  }
  if (r.problems.length) throw new Error(r.problems.join('\n'))
}

// The self conversation, resolved before a source needs it so a share isn't left waiting on it.
export const prepareSelfConversation = async () => {
  if (!sending()) return
  await leaveSharePicker()
  await requireSignedInAs(smokeUser())
  await selfConversation()
}

// Skips a source the simulator can't do, recording why in a result named after the test.
export const skipSource = (ctx: Mocha.Context, reason: string): never => {
  writeResult({problems: [], skipped: reason, source: `skipped ${ctx.test?.title ?? 'source'}`})
  return ctx.skip()
}

// Skips a source whose asset make-assets.sh could not make (an optional tool was missing).
export const skipIfMissing = (ctx: Mocha.Context, ...names: Array<string>) => {
  const missing = missingAsset(...names)
  if (missing) skipSource(ctx, `${missing} was not generated: make-assets.sh needs ffmpeg or ImageMagick for it`)
}
