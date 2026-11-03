// The share extension, driven from the apps a person shares from (Photos, Files, Safari, Maps): the
// app's share sheet is opened on one item, Keybase tapped, and the hand-off read back where it
// lands. The extension runs in its own process, so what it did is read from its app group (the
// manifest it writes into incoming-shares, and the payload files beside it) and from its log lines,
// never from the app alone. Like device.ts these credit nothing: the flow credits 'share-extension'
// once it has asserted the app took up what the extension handed over.
//
// Every payload folder a share of this run made is recorded as the manifest names it, and the
// flow's afterEach removes them (removeSharePayloads), along with a manifest this run left unclaimed;
// a removal that fails poisons the gate.
import {execFileSync} from 'child_process'
import * as fs from 'fs'
import * as http from 'http'
import * as path from 'path'
import * as T from '../../shared/test-ids'
import {requireCurrentAttempt} from './attempt.ts'
import {FILES_APP, groupContainer, openLink, preflightUdid, seedFolderPath} from './device.ts'
import {labelHas, sourceElements, sourceRect} from './page-source-lib.ts'
import {clearGatePoison, poisonGate} from './poison-lib.ts'
import {corpusCellOf, corpusCells, fileCellName, libraryCells, type LibraryName, type Rect} from './picker-lib.ts'
import {MANIFEST_NAMES, parseManifest, payloadFolder, type Handed, type ManifestItem, type ServedRequest} from './share-lib.ts'
import {typeInFilter} from '../helpers/files'
import {expectScreen, visibleScreen} from '../gate/screens'
import {tapFrame} from '../helpers/menus'
import {appState, BUNDLE_ID, FOREGROUND, simctl, waitFor} from '../helpers/lifecycle'

export const PHOTOS = 'com.apple.mobileslideshow'
export const SAFARI = 'com.apple.mobilesafari'
export const MAPS = 'com.apple.Maps'
const HOSTS = [PHOTOS, FILES_APP, SAFARI, MAPS]
const INCOMING_SHARES = 'the share payloads in incoming-shares'

const pred = (p: string) => browser.$(`-ios predicate string:${p}`)

// -- the app group ---------------------------------------------------------------------------------

// The app group's incoming-shares folder, where the extension writes its manifest and payloads. A
// build installed without signing has no app group. Bound: simctl 120.
export const incomingSharesDir = () => {
  const dir = groupContainer(BUNDLE_ID, 'group.keybase')
  if (!dir) throw new Error('keybase.ios has no group.keybase container: the installed build is not signed')
  return path.join(dir, 'Library', 'Caches', 'incoming-shares')
}

// This run's payload folders, recorded as the manifests name them, and when the first share began
// (a manifest left unclaimed from then on is this run's).
const madeFolders = new Set<string>()
let firstShareAt: number | undefined

// Watches incoming-shares for the manifest a share writes from `since` on: the service claims it as
// soon as the app asks (moves it to manifest.claimed, reads it, removes it), so it is caught while
// the share runs. Each manifest's payload folders are recorded for the cleanup as soon as it is read;
// a file outside a payload folder is kept as the share's problem (requireOneItem reports it).
const watchManifest = (dir: string, since: number) => {
  let seen: (Handed & {mtimeMs: number}) | undefined
  const peek = () => {
    for (const n of MANIFEST_NAMES) {
      let items: Array<ManifestItem>
      let mtimeMs: number
      try {
        const f = path.join(dir, n)
        mtimeMs = fs.statSync(f).mtimeMs
        if (mtimeMs < since || (seen && mtimeMs < seen.mtimeMs)) continue
        items = parseManifest(fs.readFileSync(f, 'utf8'))
      } catch {
        // not there, claimed between the stat and the read, or still being written
        continue
      }
      let folderProblem: string | undefined
      for (const i of items) {
        if (!i.originalPath) continue
        try {
          madeFolders.add(payloadFolder(dir, i.originalPath))
        } catch (e) {
          folderProblem = e instanceof Error ? e.message : String(e)
        }
      }
      seen = {folderProblem, items, mtimeMs}
    }
  }
  const timer = setInterval(peek, 50)
  return {
    stop: (): Handed => {
      clearInterval(timer)
      peek()
      return {folderProblem: seen?.folderProblem, items: seen?.items}
    },
  }
}

// Removes this run's payload folders and a manifest this run's share left unclaimed, and reads back
// that they are gone. For a flow's afterEach: a share left behind would be handed to the app again,
// so a failure poisons the gate. Bound: simctl 120.
export const removeSharePayloads = () => {
  if (!madeFolders.size && firstShareAt === undefined) return
  try {
    const dir = incomingSharesDir()
    for (const f of madeFolders) {
      fs.rmSync(payloadFolder(dir, path.join(f, 'item', 'file')), {force: true, recursive: true})
      if (fs.existsSync(f)) throw new Error('a payload folder of this run is still in incoming-shares')
    }
    const manifest = path.join(dir, 'manifest.json')
    const st = fs.statSync(manifest, {throwIfNoEntry: false})
    if (st && firstShareAt !== undefined && st.mtimeMs >= firstShareAt) {
      fs.rmSync(manifest, {force: true})
      if (fs.existsSync(manifest)) throw new Error("this run's unclaimed share manifest is still in incoming-shares")
    }
  } catch (e) {
    poisonGate(INCOMING_SHARES, "remove this run's payload folders and an unclaimed manifest.json from keybase.ios's group.keybase Library/Caches/incoming-shares")
    // no cause: a file system error holds the container path
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`removing the share payloads failed: ${e instanceof Error && !e.message.includes('/') ? e.message : 'a file error'}`)
  }
  madeFolders.clear()
  firstShareAt = undefined
  clearGatePoison(INCOMING_SHARES)
}

// -- the share extension's process and log ----------------------------------------------------------

// The running share extension processes. pgrep is host-wide; the gate runs one simulator. Bound: 5.
const extensionPids = () => {
  requireCurrentAttempt()
  try {
    return execFileSync('pgrep', ['-x', 'KeybaseShare'], {encoding: 'utf8', killSignal: 'SIGKILL', timeout: 5_000}).split('\n').filter(Boolean)
  } catch (e) {
    if ((e as {status?: number}).status === 1) return []
    throw new Error('reading the share extension processes failed', {cause: e})
  }
}

const logTime = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// The extension's own log lines (share-ext and item-provider) and any error logged by its process,
// since `since`. Bound: simctl 120.
export const extensionLogSince = (since: Date) =>
  simctl(
    'spawn',
    preflightUdid(),
    'log',
    'show',
    '--start',
    logTime(since),
    '--style',
    'compact',
    '--predicate',
    '(subsystem == "com.keybase.app" AND (category == "share-ext" OR category == "item-provider")) OR (process == "KeybaseShare" AND (messageType == error OR messageType == fault))'
  )
    .split('\n')
    .filter(l => /share-ext|item-provider|KeybaseShare/.test(l))

// -- the apps shared from -----------------------------------------------------------------------------

// Runs `fn` with element lookups in `bundleId`, freshly launched so it starts where a person would
// open it, and points them back at the app after. Bound: the terminate, the launch and the two
// settings 4, and `fn`.
const inApp = async <R,>(bundleId: string, fn: () => Promise<R>): Promise<R> => {
  await browser.execute('mobile: terminateApp', {bundleId})
  await browser.execute('mobile: activateApp', {bundleId})
  await browser.updateSettings({defaultActiveApplication: bundleId})
  try {
    return await fn()
  } finally {
    await browser.updateSettings({defaultActiveApplication: BUNDLE_ID})
  }
}

// For a flow's afterEach: closes the apps shared from (a sheet or menu left up goes with them) and
// brings the app forward. Bound: the four terminates, the settings and the launch 6.
export const leaveShareHosts = async () => {
  await browser.updateSettings({defaultActiveApplication: BUNDLE_ID})
  for (const bundleId of HOSTS) await browser.execute('mobile: terminateApp', {bundleId})
  await browser.execute('mobile: activateApp', {bundleId: BUNDLE_ID})
}

const onScreen = async (r: Rect) => {
  const {height, width} = await browser.getWindowRect()
  return r.x >= 0 && r.y >= 0 && r.x + r.width <= width && r.y + r.height <= height
}

// Holds the middle of `rect` once and taps its context menu's button named exactly `item`; the
// menu's other buttons (Delete, Paste among them) are never touched. There is no second hold: one
// made while a menu is up lands on that menu (seen live: a list row's stale frame held over the
// Files folder's own menu pasted into the folder), so a hold whose menu lacks `item` fails. `rect`
// is read until two reads half a second apart agree, so the hold lands where the item is now drawn.
// Bound: the frame 10 overrun by one read 2, the hold 1.3 and the item 5, the tap 1 = 20.
const holdThenTap = async (rect: () => Promise<Rect>, item: 'Copy' | 'Share', what: string) => {
  let last: Rect | undefined
  const r = await waitFor(
    `${what} to hold still on screen`,
    async () => {
      const now = await rect()
      const still = last && JSON.stringify(last) === JSON.stringify(now)
      last = now
      return still && (await onScreen(now)) ? now : undefined
    },
    {interval: 500, timeout: 10_000}
  )
  await browser.execute('mobile: touchAndHold', {duration: 1.3, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2)})
  const button = pred(`type == "XCUIElementTypeButton" AND name == "${item}"`)
  await button.waitForExist({interval: 200, timeout: 5_000, timeoutMsg: `${what}'s menu did not offer ${item}`})
  await button.click()
}

// In Photos (open on its library), holds the corpus photo `name` and taps its menu's `item`. Its
// cells carry only a kind and a date, so the corpus is the one run of cells sharing a date in
// LIBRARY_GRID_ORDER (picker-lib.ts), which the library draws at its end where it opens (whatever
// its sort: the run is found by its dates, so the sort is never changed). Bound: the grid 20 overrun
// by one read 2, the hold 20 = 42.
const photoMenu = async (name: LibraryName, item: 'Copy' | 'Share') => {
  const cellNow = async () => corpusCellOf(corpusCells(libraryCells(sourceElements(await browser.getPageSource()))), name).rect
  await waitFor('the corpus in the Photos library', cellNow, {interval: 1_000, timeout: 20_000})
  await holdThenTap(cellNow, item, 'the corpus photo')
}

// Photos' share sheet on the corpus photo `name`. Bound: 42.
export const photosSheet = (name: LibraryName) => async () => photoMenu(name, 'Share')

// Copies the corpus photo `name` in Photos (its menu's Copy), which puts the image on the
// pasteboard, then brings the app back. Bound: inApp 4, the menu 42, the launch 1 = 47.
export const copyPhoto = async (name: LibraryName) => {
  await inApp(PHOTOS, async () => photoMenu(name, 'Copy'))
  await browser.execute('mobile: activateApp', {bundleId: BUNDLE_ID})
}

// The Files app's share sheet on `file` in the seed folder `folder` (device.ts seedDocumentFolder),
// opened by its shareddocuments link. Files can show the folder's parent before it has caught up
// with a new folder, so the link is opened again until the file shows. Bound: the folder path 120,
// the file 30 overrun by one link 120, the hold 20 = 290.
export const filesSheet = (folder: string, file: string) => async () => {
  const link = `shareddocuments://${encodeURI(seedFolderPath(folder))}`
  const cell = pred(`type == "XCUIElementTypeCell" AND name == "${fileCellName(file)}"`)
  let reopenAt = 0
  await waitFor(
    'the seeded file in Files',
    async () => {
      if (await cell.isExisting()) return true
      if (Date.now() > reopenAt) {
        openLink(link)
        reopenAt = Date.now() + 5_000
      }
      return undefined
    },
    {interval: 500, timeout: 30_000}
  )
  const cellNow = async () => {
    const found = sourceElements(await browser.getPageSource()).filter(e => e.type === 'XCUIElementTypeCell' && e.attrs['name'] === fileCellName(file))
    if (found.length !== 1) throw new Error(`Files shows ${found.length} cells of the seeded file, not one`)
    return sourceRect(found[0]!.attrs)
  }
  await holdThenTap(cellNow, 'Share', 'the seeded file')
}

// Safari's share sheet on all the text of the text area labelled `label` on the page at `url`: the
// first tap focuses it, the second brings up its edit menu, whose Select All and then Share (paged
// in the full list behind its chevron) are tapped. Bound: the link 120, the area 15 and two taps 2, the menu 10 and
// Select All 1, Share found 25, its tap 1 = 174.
export const safariTextSheet = (url: string, label: string) => async () => {
  openLink(url)
  const area = pred(`label == "${label}"`)
  await area.waitForExist({interval: 250, timeout: 15_000, timeoutMsg: "Safari never drew the page's text area"})
  await area.click()
  const selectAll = pred('type == "XCUIElementTypeMenuItem" AND label == "Select All"')
  await waitFor(
    "the text area's edit menu",
    async () => {
      if (await selectAll.isExisting()) return true
      await area.click()
      return undefined
    },
    {interval: 1_500, timeout: 10_000}
  )
  await selectAll.click()
  // the edit menu now holds Cut, Copy, Paste and Replace, with a chevron (Forward) that opens the full
  // list, where Share sits; Forward is tapped once, only while that short menu is up
  const share = pred('(type == "XCUIElementTypeButton" OR type == "XCUIElementTypeMenuItem") AND label == "Share…"')
  const shortMenu = pred('type == "XCUIElementTypeMenuItem" AND label == "Cut"')
  // the menu's own chevron is named Forward; Safari's toolbar button of that label is ForwardButton
  const forward = pred('type == "XCUIElementTypeButton" AND name == "Forward" AND label == "Forward"')
  let opened = false
  await waitFor(
    "the edit menu's Share",
    async () => {
      if (await share.isExisting()) return true
      if (!opened && (await shortMenu.isExisting()) && (await forward.isExisting())) {
        await forward.click()
        opened = true
      }
      return undefined
    },
    {interval: 1_000, timeout: 25_000}
  )
  await share.click()
}

// Maps' share sheet on the place card of `place` (a stamped marker) at a fixed point. Maps reopens on
// the place it last showed, whose card has a Share too (seen live: a share of the last run's place),
// so Share is tapped only once the screen names `place`; and as Maps can swap the card for a search
// sheet holding only the address, the link is opened again until it does. Bound: the card 45
// overrun by one link 120 and two reads 2, the tap 1 = 168.
export const mapsSheet = (lat: number, lon: number, place: string) => async () => {
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(place)) throw new Error('a Maps place is not a stamped marker')
  const link = `maps://?ll=${lat},${lon}&q=${encodeURIComponent(place)}`
  const share = pred('name == "CardButtonTypeShare"')
  const named = pred(`label CONTAINS "${place}"`)
  let reopenAt = 0
  await waitFor(
    "the Maps place card's Share for the place",
    async () => {
      if ((await named.isExisting()) && (await share.isExisting())) return true
      if (Date.now() > reopenAt) {
        openLink(link)
        reopenAt = Date.now() + 8_000
      }
      return undefined
    },
    {interval: 1_000, timeout: 45_000}
  )
  await share.click()
}

// -- the share ---------------------------------------------------------------------------------------

export type Shared = Handed & {log: Array<string>}

// In `host`, opens its share sheet (`open`) and taps Keybase, until the extension starts (a sheet
// still loading its preview takes a tap without acting on it); then waits for the extension to open
// the app, and answers the manifest it wrote and its log lines. The extension's own watchdog gives
// up after 120s. Bound: the container 120, the pids 5, inApp 4, `open`, the Keybase cell 15, the
// start 30 overrun by one try 7, the app 150, the log 120 = 451 and `open`.
export const shareToKeybase = async (host: string, open: () => Promise<void>): Promise<Shared> => {
  const startedAt = Date.now() - 1_000
  firstShareAt ??= startedAt
  const dir = incomingSharesDir()
  const watch = watchManifest(dir, startedAt)
  // a share's payload folder is made whatever it holds (a text share's stays empty, and its manifest
  // names no file in it), so the folders new since the share began are this run's too
  const entries = () => (fs.existsSync(dir) ? fs.readdirSync(dir) : [])
  const entriesBefore = new Set(entries())
  let handed: Handed
  try {
    const before = new Set(extensionPids())
    await inApp(host, async () => {
      await open()
      const keybase = pred('name == "shareCell" AND label == "Keybase"')
      await keybase.waitForExist({interval: 250, timeout: 15_000, timeoutMsg: 'the share sheet never offered Keybase'})
      await waitFor(
        'the share extension to start',
        async () => {
          if (extensionPids().some(p => !before.has(p))) return true
          if ((await appState()) === FOREGROUND) return true
          if (await keybase.isExisting()) await keybase.click()
          return undefined
        },
        {interval: 2_500, timeout: 30_000}
      )
    })
    await waitFor('the share extension to open the app', async () => ((await appState()) === FOREGROUND ? true : undefined), {
      interval: 500,
      timeout: 150_000,
    })
  } finally {
    handed = watch.stop()
    for (const n of entries()) {
      const f = path.join(dir, n)
      if (!entriesBefore.has(n) && fs.statSync(f, {throwIfNoEntry: false})?.isDirectory()) madeFolders.add(payloadFolder(dir, path.join(f, 'item', 'file')))
    }
  }
  return {...handed, log: extensionLogSince(new Date(startedAt))}
}

// The extension's log holds no failed share (ShareViewController's "share failed: ..." lines).
export const requireExtensionLogClean = (log: ReadonlyArray<string>) => {
  if (log.some(l => l.includes('share failed'))) throw new Error('the share extension logged a failed share')
}

// -- the app's share screen ------------------------------------------------------------------------

// On the app's share screen (incomingShareNew), finds the smoke account's self conversation by its
// exact name in the picker's search and taps its row: rows are read off one page source (the name
// goes into no selector or error), and exactly one must read as it. Bound: the screen 31, the search
// 32, the row 20 overrun by one read 2, the tap 1 = 86.
export const pickSelfInSharePicker = async (smokeUser: string) => {
  await expectScreen("the app's share screen", 'incomingShareNew', () => true, 30_000)
  await typeInFilter(smokeUser, "the share screen's search")
  const row = await waitFor(
    'the self conversation row in the share picker',
    async () => {
      const rows = sourceElements(await browser.getPageSource()).filter(
        e => e.attrs['name'] === T.CHAT_SEND_TO_CHAT_ROW && labelHas(e.attrs['label'] ?? '', smokeUser)
      )
      if (rows.length > 1) throw new Error(`${rows.length} rows of the share picker read as the self conversation, not one`)
      return rows[0]
    },
    {interval: 1_000, timeout: 20_000}
  )
  await tapFrame(sourceRect(row.attrs), 'the self conversation row')
}

// For a flow's afterEach: leaves the app's share screen through its own Cancel. escapeToTabs never
// runs over the picker: a tap of its could land on a conversation row, which picks it. Bound: the
// read 1, Cancel 5 and its tap 1, gone 10 = 17.
export const leaveSharePicker = async () => {
  if ((await visibleScreen())?.name !== 'incomingShareNew') return
  const cancel = pred('type == "XCUIElementTypeButton" AND label == "Cancel"')
  await cancel.waitForExist({timeout: 5_000, timeoutMsg: "the share screen's Cancel did not show"})
  await cancel.click()
  await waitFor(
    'the share screen to close',
    async () => ((await visibleScreen())?.name === 'incomingShareNew' ? undefined : true),
    {interval: 500, timeout: 10_000}
  )
}

// -- Safari's pages ----------------------------------------------------------------------------------

// Serves `files` (name to contents) to Safari on the loopback interface only (the simulator shares
// the host's), recording every request so a flow can tell what the extension fetched.
export const startPageServer = async (files: ReadonlyMap<string, string>) => {
  const requests: Array<ServedRequest> = []
  const server = http.createServer((req, res) => {
    requests.push({method: req.method ?? '', path: req.url ?? '', userAgent: req.headers['user-agent'] ?? ''})
    const body = files.get((req.url ?? '/').split('?')[0]?.slice(1) ?? '')
    if (body === undefined) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, {'Content-Length': Buffer.byteLength(body), 'Content-Type': 'text/html; charset=utf-8'})
    res.end(req.method === 'HEAD' ? undefined : body)
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('the page server has no port')
  return {close: () => server.close(), origin: `http://127.0.0.1:${address.port}`, requests}
}
