// Settings that save, changed from the phone as the smoke account, one setting per test: each test
// reads the original, changes it from the phone's own screen (the call it sends checked in the
// recorder's log), reads it back (from the server through the host for what the account keeps there,
// from the phone's own service for what lives on the phone) and on the screen, relaunches the app and
// reads it again on the screen, then changes it back from the phone and reads that back.
//
// - Chat: link previews (a radio and its Save), who may message the account (the switch and its
//   Save), message content in phone chat notifications (the switch), and the iOS photos and videos
//   setting (Compress / Keep full size).
// - Notifications: the first email notification setting (an account unsubscribed from all of them
//   is refused; "Unsubscribe from all" is never pressed). The phone push group needs the push grant,
//   which the native-surfaces flows cover.
// - Display: the theme, "Respect system settings" and the fixed theme the run uses (Light, or Dark
//   in a KB_E2E_THEME=dark run; the other one is never pressed, and a system in the other appearance
//   is refused), and Allow animated emoji.
// - Advanced: lockdown mode (refused unless it starts off), Save Proxy Settings with the settings the
//   form loaded (refused unless the phone has no proxy, so the save can never point it at one; the
//   network is checked after), Enable Detailed Logging (read off the phone's service log, where the
//   in-process KBFS logs each level it is set to; it lives only in the running app, so it is put back
//   by the harness, not read after a relaunch), and the developer section's Toggle Runtime Stats (the
//   overlay and the More list's perf row, on, through a relaunch, and off again).
//
// The switch and radio states are read off their testIDs, which say what each shows, or that it is
// still loading or saving (test-ids.ts SETTING_*), since the control alone has no state in the tree.
//
// The flow's afterEach puts back everything the test may have changed, after a timeout too, each one
// read back: first what could break the files after this one (the proxy, with the network checked;
// lockdown; the theme; the notification settings; link previews; who may message), then the rest.
// Each restore of what the account keeps on the server goes through the host's main service, which
// checks it is signed in as the smoke account first; what lives on the phone goes through the phone's
// own service (askApp). A restore that fails throws, and every later test of the file refuses with
// what to put back by hand; for the proxy, lockdown or the theme, which break the app for every later
// file too, every later test of the whole gate refuses (gate/poison-lib.ts).
//
// Never pressed: Dark, "Allow TLS Interception" (and its "Yes, I am sure"), DB Nuke, Clear Logs,
// Trace, CPU Profile, the perf row's PerfLog, "Unsubscribe from all", a lockdown "Read more" link.
import * as fs from 'fs'
import {withCleanup} from '../../shared/cleanup.ts'
import {
  contactSettings,
  emailSubscriptions,
  emojiAnimations,
  globalNotifSettings,
  lockdown,
  restoreContactSettings,
  restoreEmailSubscriptions,
  restoreEmojiAnimations,
  restoreGlobalNotifSettings,
  restoreUnfurlSettings,
  same,
  setLockdownMode,
  sortedUnfurl,
  unfurlSettings,
  type ContactSettings,
  type EmailSubscription,
  type UnfurlSettings,
} from '../../shared/settings'
import * as T from '../../shared/test-ids'
import {relaunchOnSmoke, requireAppIsSmoke} from '../gate/accounts'
import {
  compressPreference,
  darkModeState,
  guiClearValue,
  guiSetValue,
  guiValue,
  phoneReachesServer,
  proxyData,
  randomPW,
  runtimeStatsEnabled,
  setCompressPreference,
  setDebugLevel,
  setProxyData,
  toggleRuntimeStats,
  type CompressPreference,
  type GuiValue,
  type ProxyData,
} from '../gate/app-ask'
import {isAttemptOver} from '../gate/attempt-binding-lib'
import {creditSurface} from '../gate/attempt'
import {clearGatePoison, poisonGate} from '../gate/poison-lib.ts'
import {frameInside, rectOf} from '../gate/chat-lib.ts'
import {proxySaveWrites, rectsOverlap, vdebugDetailed, vdebugLevels} from '../gate/persisted-lib.ts'
import {currentCallSeq} from '../gate/recorder'
import {step} from '../gate/step'
import {dragUntilOnScreen} from '../helpers/chat'
import {el} from '../helpers/elements'
import {tapButton} from '../helpers/files'
import {goLogMark, waitFor} from '../helpers/lifecycle'
import {linesSince} from '../gate/go-log-lib.ts'
import {BUTTON_ELEMENTS, check, labelledElement, NAMED_ELEMENT_TYPES, screenRect} from '../helpers/menus'
import {escapeToTabs} from '../helpers/navigate'
import {openMore, openSettingsPage} from '../helpers/settings'
import {
  calledOnce,
  expectShown,
  openNotificationSettings,
  radioOf,
  saveAndCall,
  settles,
  switchOf,
  tapAndCall,
  tapControl,
  type Shown,
} from '../helpers/setting-controls'
import {masked} from '../helpers/teams'
import {labelHas, sourceElements, sourceRect} from '../gate/page-source-lib'
import {iosTheme} from '../theme'

const SAVE_UNFURL = 'chat.1.local.saveUnfurlSettings'
const SET_CONTACT = 'keybase.1.account.userSetContactSettings'
const SET_GLOBAL_NOTIF = 'chat.1.local.setGlobalAppNotificationSettingsLocal'
const POST_JSON = 'keybase.1.apiserver.PostJSON'
const SET_COMPRESS = 'keybase.1.incomingShare.setPreference'
const GUI_SET = 'keybase.1.config.guiSetValue'
const TOGGLE_EMOJI = 'chat.1.local.toggleEmojiAnimations'
const SET_LOCKDOWN = 'keybase.1.account.setLockdownMode'
const SET_PROXY = 'keybase.1.config.setProxyData'
const SET_DEBUG = 'keybase.1.SimpleFS.simpleFSSetDebugLevel'
const TOGGLE_STATS = 'keybase.1.config.toggleRuntimeStats'

// The chat unfurl flow keeps the account's link preview settings here while it runs, and puts them
// back from it at its next start when a run died (chat-unfurl.test.ts): while the file is there the
// account's settings are that flow's test settings, not the original.
const UNFURL_FLOW_BACKUP = '/tmp/kb-e2e-chat-unfurl-settings.json'

// GlobalAppNotificationSetting.plaintextmobile, as the chat notification settings map keys it
const PLAINTEXT_MOBILE = '1'

// UnfurlMode, as the link preview radios' testIDs name it
const UNFURL_MODES: Record<number, string | undefined> = {0: 'always', 1: 'never', 2: 'whitelisted'}
const modeOf = (s: UnfurlSettings) => UNFURL_MODES[s.mode]
const DEVELOPER_LINE = "Please don't do anything below here unless instructed to by a developer."
// the developer controls show after this many taps on the line (settings/advanced.tsx)
const DEVELOPER_TAPS = 7

// -- pages ---------------------------------------------------------------------------------------

const openChat = async () => openSettingsPage('Chat', 'settingsTabs.chatTab', T.SETTINGS_CHAT, T.SETTINGS_ROW_CHAT)
const openDisplay = async () => openSettingsPage('Display', 'settingsTabs.displayTab', T.SETTINGS_DISPLAY)
const openAdvanced = async () => openSettingsPage('Advanced', 'settingsTabs.advancedTab', T.SETTINGS_ADVANCED)

// -- one setting, changed and back ---------------------------------------------------------------

type Case<V> = {
  // the setting in steps and errors
  what: string
  open: () => Promise<void>
  // the control that shows `v`, and what it shows then
  shown: (v: V) => Shown
  // changes the setting to `v` from the phone, the call it sends checked
  change: (v: V) => Promise<void>
  // the setting as the server (through the host) or the phone's service holds it
  read: () => Promise<V>
}

// Shown, changed to `other`, read back and shown; relaunched, shown and read; changed back to `was`,
// read back and shown. Bound: open 126, shown 41, step 2, change C, settles S, shown 41, step 2,
// relaunched 291, open 126, shown 41, settles S, step 2, change C, settles S, shown 41, step 2 = 715 +
// 2C + 3S.
const roundTrip = async <V,>(c: Case<V>, was: V, other: V) => {
  await c.open()
  await expectShown(c.shown(was), `${c.what} before the change`)
  await step(`${c.what} before the change`)

  await c.change(other)
  await settles(`${c.what} to read back changed`, c.read, other)
  await expectShown(c.shown(other), `${c.what} after the change`)
  await step(`${c.what} changed`, {card: true})

  await relaunchOnSmoke()
  await c.open()
  await expectShown(c.shown(other), `${c.what} after a relaunch`)
  await settles(`${c.what} to read back changed after a relaunch`, c.read, other)
  creditSurface('relaunch')
  await step(`${c.what} after a relaunch`)

  await c.change(was)
  await settles(`${c.what} to read back changed back`, c.read, was)
  await expectShown(c.shown(was), `${c.what} after the change back`)
  await step(`${c.what} changed back`)
}

// -- the KBFS debug level, from the phone's service log ---------------------------------------------

// The debug levels set in the phone's service log since `mark`. The log's path (in the app's
// container) and its other lines never leave here: a failed read names neither. Bound: one read 1.
const levelsSince = (mark: ReturnType<typeof goLogMark>) => {
  try {
    return vdebugLevels(linesSince(mark))
  } catch (e) {
    if (isAttemptOver(e)) throw e
    // no cause: the error names the log's path
    // eslint-disable-next-line preserve-caught-error
    throw new Error("reading the phone's service log failed")
  }
}

// A mark at the end of the phone's service log. Bound: the container's path 120.
const logMark = () => {
  try {
    return goLogMark()
  } catch (e) {
    if (isAttemptOver(e)) throw e
    // eslint-disable-next-line preserve-caught-error
    throw new Error("finding the phone's service log failed")
  }
}

// Waits for the log to set `level` after `mark`. Bound: 20s of reads, overrun by one 1 = 21.
const levelSetSince = async (mark: ReturnType<typeof goLogMark>, level: string, what: string) =>
  waitFor(what, () => (levelsSince(mark).includes(level) ? true : undefined), {interval: 500, timeout: 20_000})

// -- the More list -------------------------------------------------------------------------------

// The More list off one page source: how many texts on screen hold the Crypto row's label as a part
// (a row merges its texts into one label), and how many PerfLog buttons (the perf row's, shown while
// runtime stats are on) the tree holds. XCUITest can report the whole list visible=false (seen live),
// so a frame on screen stands for visible. Bound: the source and the window 2.
const moreListDraws = async () => {
  const screen = await screenRect()
  let crypto = 0
  let perf = 0
  for (const {attrs, type} of sourceElements(await browser.getPageSource())) {
    const label = (attrs['label'] ?? '').replace(/\u00a0/g, ' ')
    if (type === 'XCUIElementTypeButton' && label === 'PerfLog') perf++
    if (!NAMED_ELEMENT_TYPES.includes(type) || !labelHas(label, 'Crypto')) continue
    if (frameInside(sourceRect(attrs), screen)) crypto++
  }
  return {crypto, perf}
}

describe('settings persisted', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   smoke     requireAppIsSmoke 1;  host  a host read 150;  ask  an askApp 22 (20, the pause and
  //             resume 2);  reach  phoneReachesServer 111
  //   round     roundTrip 715 + 2C + 3S, C the change's bound, S its settles (host 180, phone 52)
  //   tap       tapAndCall 37;  save  saveAndCall 37;  shown  expectShown 41;  control  tapControl 21
  //   open      openSettingsPage 126;  more  openMore 50;  relaunched  291
  //   step      2 (its 1s settle and the attach)
  //   mark      logMark 120;  level  levelSetSince 21
  //   restore   a host restore 355 (a read 150, the write 35, 20s of reads overrun by one 150 = 170)

  // -- what the afterEach puts back -----------------------------------------------------------------

  // What the test may have changed, with its original: set before the first change, cleared once it
  // is put back.
  type Touched = {
    proxy?: ProxyData
    lockdown?: true
    theme?: {original: GuiValue | undefined}
    notifications?: {map: Record<string, boolean>; subscriptions: Array<EmailSubscription>}
    unfurl?: UnfurlSettings
    contact?: ContactSettings
    compress?: CompressPreference
    emoji?: boolean
    debugLevel?: string
    runtimeStats?: true
  }
  const touched: Touched = {}
  // what a restore failed to put back, with where the owner puts it back by hand
  const unrestored = new Map<string, string>()

  // `breaksPhone`: left changed, the setting breaks the app for every later file too, so a failed
  // restore also stops the whole gate (poison-lib.ts).
  const guarded = (name: string, byHand: string, restore: () => Promise<void>, breaksPhone = false) => async () => {
    try {
      await restore()
      unrestored.delete(name)
      if (breaksPhone) clearGatePoison(name)
    } catch (e) {
      unrestored.set(name, byHand)
      if (breaksPhone) poisonGate(name, byHand)
      throw e
    }
  }

  // Bound: ask 22, the set 22, the read 22, reach 111 = 177.
  const restoreProxy = guarded(
    'the proxy settings',
    'on the phone open Settings > Advanced, choose No proxy and press Save Proxy Settings, then check the phone reaches the network',
    async () => {
      const original = touched.proxy
      if (!original) return
      if (!same(await proxyData(), original)) {
        await setProxyData(original)
        check(same(await proxyData(), original), 'the proxy settings did not read back as put back')
      }
      check(await phoneReachesServer(), "the phone's service does not reach the server after the proxy restore")
      touched.proxy = undefined
    },
    true
  )

  // Bound: restore 355.
  const restoreLockdown = guarded(
    'lockdown mode',
    'turn it off in Settings > Advanced',
    async () => {
      if (!touched.lockdown) return
      await masked(async () => setLockdownMode(false))
      touched.lockdown = undefined
    },
    true
  )

  // Bound: ask 22, the set or clear 22, the read 22 = 66.
  const restoreTheme = guarded(
    'the theme',
    'choose it again in Settings > Display (never Dark)',
    async () => {
    const t = touched.theme
    if (!t) return
    if (!same(await guiValue('ui.darkMode'), t.original)) {
      if (t.original) await guiSetValue('ui.darkMode', t.original)
      else await guiClearValue('ui.darkMode')
      check(same(await guiValue('ui.darkMode'), t.original), 'the theme did not read back as put back')
    }
    touched.theme = undefined
    },
    true
  )

  // Bound: two host restores 710.
  const restoreNotifications = guarded(
    'the chat and email notification settings',
    'set them again in Settings > Chat and Settings > Notifications',
    async () => {
      const n = touched.notifications
      if (!n) return
      await masked(async () => restoreGlobalNotifSettings(n.map))
      await masked(async () => restoreEmailSubscriptions(n.subscriptions))
      touched.notifications = undefined
    }
  )

  // Bound: restore 355.
  const restoreUnfurl = guarded('the link preview settings', 'set them again in Settings > Chat', async () => {
    const original = touched.unfurl
    if (!original) return
    await masked(async () => restoreUnfurlSettings(original))
    touched.unfurl = undefined
  })

  // Bound: restore 355.
  const restoreContact = guarded('who may message the account', 'set it again in Settings > Chat', async () => {
    const original = touched.contact
    if (!original) return
    await masked(async () => restoreContactSettings(original))
    touched.contact = undefined
  })

  // Bound: ask 22, the set 22, the read 22 = 66.
  const restoreCompress = guarded('the photos and videos setting', 'choose it again in Settings > Chat', async () => {
    const was = touched.compress
    if (!was) return
    if ((await compressPreference()) !== was) {
      await setCompressPreference(was)
      check((await compressPreference()) === was, 'the photos and videos setting did not read back as put back')
    }
    touched.compress = undefined
  })

  // Bound: restore 355.
  const restoreEmoji = guarded('allow animated emoji', 'set it again in Settings > Display', async () => {
    const was = touched.emoji
    if (was === undefined) return
    await masked(async () => restoreEmojiAnimations(was))
    touched.emoji = undefined
  })

  // Bound: mark 120, the set 22, level 21 = 163.
  const restoreDebugLevel = guarded('the KBFS debug level', 'relaunch the app (the level lives only in the running app)', async () => {
    const was = touched.debugLevel
    if (was === undefined) return
    const mark = logMark()
    await setDebugLevel(was)
    await levelSetSince(mark, was, 'the KBFS debug level put back in the log')
    touched.debugLevel = undefined
  })

  // Bound: ask 22, the toggle 22, 30s of asks overrun by one 22 = 96.
  const restoreRuntimeStats = guarded(
    'the runtime stats',
    'turn them off in Settings > Advanced (tap the developer line 7 times, then Toggle Runtime Stats)',
    async () => {
      if (!touched.runtimeStats) return
      if (await runtimeStatsEnabled()) {
        await toggleRuntimeStats()
        await settles('the runtime stats off after the restore', runtimeStatsEnabled, false)
      }
      touched.runtimeStats = undefined
    }
  )

  // A restore that failed leaves the app or the account changed: no later test runs on it.
  beforeEach(function () {
    if (!unrestored.size) return
    const what = [...unrestored].map(([name, byHand]) => `${name} (${byHand})`).join('; ')
    throw new Error(`refusing to run: an earlier test's cleanup could not put back ${what}; put it back by hand and run the file again`)
  })

  // A test changes one setting (the notification tests both maps), so its restores sum at most to
  // the notifications' 710; one an earlier afterEach failed to put back is tried again (another 710
  // at most), then escapeToTabs 30 = 1450.
  afterEach(async function () {
    this.timeout(1_500_000)
    // what could break the later files goes first
    await withCleanup(restoreProxy, [
      restoreLockdown,
      restoreTheme,
      restoreNotifications,
      restoreUnfurl,
      restoreContact,
      restoreCompress,
      restoreEmoji,
      restoreDebugLevel,
      restoreRuntimeStats,
      escapeToTabs,
    ])
  })

  // -- chat ------------------------------------------------------------------------------------------

  it('Chat > link previews: a mode saved from the phone, read back on the server and after a relaunch, and saved back', async function () {
    // worst case (s): smoke 1, host 150; round with C = control 21 + shown 41 + save 37 = 99 and S
    // 180: 715 + 198 + 540 = 1453; = 1604
    this.timeout(1_650_000)
    check(
      !fs.existsSync(UNFURL_FLOW_BACKUP),
      "refusing to change link previews: the chat unfurl flow's saved settings are still there (it put them back from that file at its next start), so the account's settings now are that flow's"
    )
    await requireAppIsSmoke()
    const original = await masked(async () => unfurlSettings())
    const was = modeOf(original)
    if (was === undefined) throw new Error('the link preview mode is not one the settings page offers')
    // never and always: the domain lists stay as they are
    const other = original.mode === 0 ? 'never' : 'always'
    touched.unfurl = original
    await roundTrip<string>(
      {
        change: async v => {
          await tapControl(radioOf(T.SETTINGS_UNFURL_MODE_PREFIX, v).base, 'the link preview radio')
          await expectShown(radioOf(T.SETTINGS_UNFURL_MODE_PREFIX, v), 'the link preview radio picked')
          await saveAndCall(T.SETTINGS_UNFURL_SAVE, SAVE_UNFURL, 'the link preview save')
        },
        open: openChat,
        read: async () => masked(async () => modeOf(await unfurlSettings()) ?? 'unknown'),
        shown: v => radioOf(T.SETTINGS_UNFURL_MODE_PREFIX, v),
        what: 'Link previews',
      },
      was,
      other
    )
    // the lists went back as they were
    const now = await masked(async () => unfurlSettings())
    check(same(sortedUnfurl(now), sortedUnfurl(original)), 'the link preview settings are not the original after the change back')
  })

  it('Chat > who may message the account: switched and saved from the phone, read back on the server and after a relaunch, and back', async function () {
    // worst case (s): smoke 1, host 150; round with C = control 21 + shown 41 + save 37 = 99 and S
    // 180: 1453; = 1604
    this.timeout(1_650_000)
    await requireAppIsSmoke()
    const original = await masked(async () => contactSettings())
    touched.contact = original
    await roundTrip<boolean>(
      {
        change: async on => {
          await tapControl(T.SETTINGS_CONTACT_SWITCH, 'the contact settings switch')
          await expectShown(switchOf(T.SETTINGS_CONTACT_SWITCH, on), 'the contact settings switch flipped')
          await saveAndCall(T.SETTINGS_CONTACT_SAVE, SET_CONTACT, 'the contact settings save')
        },
        open: openChat,
        read: async () => masked(async () => (await contactSettings()).enabled),
        shown: on => switchOf(T.SETTINGS_CONTACT_SWITCH, on),
        what: 'Who may message',
      },
      original.enabled,
      !original.enabled
    )
  })

  it('Chat > message content in phone chat notifications: switched from the phone, read back on the server and after a relaunch, and back', async function () {
    // worst case (s): smoke 1, host 150 x2; round with C = tap 37 and S 180: 715 + 74 + 540 = 1329;
    // = 1630
    this.timeout(1_650_000)
    await requireAppIsSmoke()
    // a toggle saves the email settings too (the app posts every group it loaded), so both go back
    const map = await masked(async () => globalNotifSettings())
    const subscriptions = await masked(async () => emailSubscriptions())
    touched.notifications = {map, subscriptions}
    const base = `${T.SETTINGS_NOTIFY_SWITCH_PREFIX}security-plaintextmobile`
    const was = !!map[PLAINTEXT_MOBILE]
    await roundTrip<boolean>(
      {
        change: async () => tapAndCall(base, SET_GLOBAL_NOTIF, 'the chat notification settings save'),
        open: openChat,
        read: async () => masked(async () => !!(await globalNotifSettings())[PLAINTEXT_MOBILE]),
        shown: on => switchOf(base, on),
        what: 'Message content in phone notifications',
      },
      was,
      !was
    )
  })

  it('Chat > photos and videos: Compress or Keep full size picked from the phone, read back on the phone and after a relaunch, and back', async function () {
    // worst case (s): smoke 1, ask 22; round with C = tap 37 and S 52: 715 + 74 + 156 = 945; = 968
    this.timeout(1_000_000)
    await requireAppIsSmoke()
    const was = await compressPreference()
    const other: CompressPreference = was === 'compressed' ? 'original' : 'compressed'
    touched.compress = was
    await roundTrip<CompressPreference>(
      {
        change: async v => tapAndCall(radioOf(T.SETTINGS_COMPRESS_PREFIX, v).base, SET_COMPRESS, 'the photos and videos setting'),
        open: openChat,
        read: compressPreference,
        shown: v => radioOf(T.SETTINGS_COMPRESS_PREFIX, v),
        what: 'Photos and videos',
      },
      was,
      other
    )
  })

  // -- notifications ---------------------------------------------------------------------------------

  it('Notifications > the first email notification: switched from the phone, read back on the server and after a relaunch, and back', async function () {
    // worst case (s): smoke 1, host 150 x2; round with C = tap 37 and S 180: 1329; = 1630
    this.timeout(1_650_000)
    await requireAppIsSmoke()
    // refuses an account unsubscribed from all of them
    const subscriptions = await masked(async () => emailSubscriptions())
    // a toggle saves the chat notification settings too, so both go back
    const map = await masked(async () => globalNotifSettings())
    touched.notifications = {map, subscriptions}
    const first = subscriptions[0]!
    check(/^[a-z0-9_]+$/.test(first.name), 'the first email notification setting has a name that is not plain')
    const base = `${T.SETTINGS_NOTIFY_SWITCH_PREFIX}email-${first.name}`
    const subscribed = async () => {
      const s = (await masked(async () => emailSubscriptions())).find(x => x.name === first.name)
      check(s !== undefined, 'the email notification setting is gone from the account')
      return s!.subscribed
    }
    await roundTrip<boolean>(
      {
        change: async () => tapAndCall(base, POST_JSON, 'the email notification settings save'),
        open: openNotificationSettings,
        read: subscribed,
        shown: on => switchOf(base, on),
        what: 'Email notification',
      },
      first.subscribed,
      !first.subscribed
    )
  })

  // -- display -------------------------------------------------------------------------------------

  it("Display > theme: the run's theme and the system theme picked from the phone, read back on the phone and after a relaunch, and back", async function () {
    // worst case (s): smoke 1, ask 22 x2; round with C = tap 37 and S 52: 945; = 990
    this.timeout(1_000_000)
    await requireAppIsSmoke()
    const runTheme = iosTheme()
    const runDark = runTheme === 'dark'
    const original = await guiValue('ui.darkMode')
    const was = original?.s ?? 'system'
    const fixed = runDark ? 'alwaysDark' : 'alwaysLight'
    check(was === 'system' || was === fixed, `refusing to change the theme: the phone is not on the ${runTheme} or the system theme (the run is ${runTheme})`)
    const dark = await darkModeState()
    check(dark.supported, 'refusing to change the theme: the phone does not offer "Respect system settings"')
    // the system theme is the other end: a system in the other appearance would change the app's
    check(dark.systemDark === runDark, `refusing to change the theme: the simulator is not in ${runTheme} appearance (the run is ${runTheme})`)
    const other = was === 'system' ? fixed : 'system'
    touched.theme = {original}
    await roundTrip<string>(
      {
        change: async v => tapAndCall(radioOf(T.SETTINGS_THEME_PREFIX, v).base, GUI_SET, 'the theme'),
        open: openDisplay,
        read: async () => (await guiValue('ui.darkMode'))?.s ?? 'system',
        shown: v => radioOf(T.SETTINGS_THEME_PREFIX, v),
        what: 'Theme',
      },
      was,
      other
    )
  })

  it('Display > allow animated emoji: switched from the phone, read back on the server and after a relaunch, and back', async function () {
    // worst case (s): smoke 1, host 150; round with C = tap 37 and S 180: 1329; = 1480
    this.timeout(1_500_000)
    await requireAppIsSmoke()
    const was = await masked(async () => emojiAnimations())
    touched.emoji = was
    await roundTrip<boolean>(
      {
        change: async () => tapAndCall(T.SETTINGS_ANIMATED_EMOJI_SWITCH, TOGGLE_EMOJI, 'the animated emoji setting'),
        open: openDisplay,
        read: async () => masked(async () => emojiAnimations()),
        shown: on => switchOf(T.SETTINGS_ANIMATED_EMOJI_SWITCH, on),
        what: 'Animated emoji',
      },
      was,
      !was
    )
  })

  // -- advanced ------------------------------------------------------------------------------------

  it('Advanced > lockdown mode: on from the phone, read back on the server and after a relaunch, and off again', async function () {
    // worst case (s): smoke 1, host 150, ask 22; round with C = tap 37 and S 180: 1329; = 1502
    this.timeout(1_600_000)
    await requireAppIsSmoke()
    check(!(await masked(async () => lockdown())), 'refusing to turn lockdown mode on: it is already on for the smoke account (the flow starts from off and leaves it off)')
    check(!(await randomPW()), 'refusing to turn lockdown mode on: the smoke account has no password, so the switch is off limits')
    touched.lockdown = true
    await roundTrip<boolean>(
      {
        change: async () => tapAndCall(T.SETTINGS_LOCKDOWN_SWITCH, SET_LOCKDOWN, 'the lockdown mode setting'),
        open: openAdvanced,
        read: async () => masked(async () => lockdown()),
        shown: on => switchOf(T.SETTINGS_LOCKDOWN_SWITCH, on),
        what: 'Lockdown mode',
      },
      false,
      true
    )
  })

  it('Advanced > proxy: the settings the form loaded saved from the phone, read back on the phone and after a relaunch, and put back', async function () {
    // worst case (s): smoke 1, ask 22, open 126, the Save drawn (the drag 20, loaded 10) 30, step 2,
    // the save (seq 2, its tap 1, calledOnce 14) 17, settles 52, reach 111, step 2; relaunched 291,
    // settles 52, reach 111, open 126, the Save drawn 30, step 2; restoreProxy 177, step 2 = 1154
    this.timeout(1_190_000)
    await requireAppIsSmoke()
    const original = await proxyData()
    // with no proxy, the address the save writes is never used: the phone cannot be cut off
    check(original.proxyType === 0, 'refusing to save the proxy settings: the phone has a proxy set, and a save that rewrote its address would cut it off the network')
    const written = proxySaveWrites(original)
    touched.proxy = original
    // The Save on screen, once the form has loaded the phone's settings (a save before then writes
    // the empty form). Bound: the drag 20, loaded 10 = 30.
    const loadedSave = async () => {
      const either = `-ios predicate string:name IN {"${T.SETTINGS_PROXY_SAVE}", "${T.SETTINGS_PROXY_SAVE}${T.SETTING_PENDING}"}`
      await dragUntilOnScreen('Save Proxy Settings', () => browser.$(either))
      await el(T.SETTINGS_PROXY_SAVE).waitForExist({timeout: 10_000, timeoutMsg: 'the proxy settings never loaded into the form'})
    }

    await openAdvanced()
    await loadedSave()
    await step('Proxy settings before the save')
    const seq = await currentCallSeq()
    await el(T.SETTINGS_PROXY_SAVE).click()
    await calledOnce(seq, SET_PROXY, 'the proxy settings save')
    await settles('the proxy settings to read back as saved', proxyData, written)
    check(await phoneReachesServer(), "the phone's service does not reach the server after the proxy save")
    await step('Proxy settings saved', {card: true})

    await relaunchOnSmoke()
    await settles('the proxy settings to read back as saved after a relaunch', proxyData, written)
    check(await phoneReachesServer(), "the phone's service does not reach the server after a relaunch")
    await openAdvanced()
    await loadedSave()
    creditSurface('relaunch')
    await step('Proxy settings after a relaunch')

    // the form always writes a port, so the settings exactly as they were go back through the
    // phone's own service, and the network is checked again
    await restoreProxy()
    await step('Proxy settings put back')
  })

  it('Advanced > Enable Detailed Logging: the phone service log shows the level set, and the original put back', async function () {
    // worst case (s): smoke 1, mark 120, relaunched 291, a read 1, open 126, the button on screen
    // 20, step 2, mark 120, seq 2, tapButton 7, calledOnce 14, level 21, step 2, mark 120, the set 22,
    // level 21, step 2 = 892
    this.timeout(950_000)
    await requireAppIsSmoke()
    // a new process starts at its own level, logged when KBFS starts if it is not the default: only
    // lines written since the mark, which is taken before the relaunch, are the new process's (or
    // the old one's last moments, which set no level), so no earlier launch's level is read
    const fromLaunch = logMark()
    await relaunchOnSmoke()
    const was = levelsSince(fromLaunch).at(-1) ?? 'vlog0'
    check(!vdebugDetailed(was), 'refusing: KBFS detailed logging is already on in the relaunched app, so the button cannot be seen to turn it on')
    touched.debugLevel = was

    await openAdvanced()
    const button = '-ios predicate string:type == "XCUIElementTypeButton" AND label == "Enable Detailed Logging" AND visible == 1'
    await dragUntilOnScreen('Enable Detailed Logging', () => browser.$(button))
    await step('Advanced before detailed logging')
    const mark = logMark()
    const seq = await currentCallSeq()
    await tapButton('Enable Detailed Logging', 'the Enable Detailed Logging button')
    await calledOnce(seq, SET_DEBUG, 'the KBFS debug level')
    await levelSetSince(mark, 'vlog2', "detailed logging in the phone's service log")
    await step('Detailed logging on', {card: true})

    // the app has no control that turns it off, and a relaunch would reset it rather than read it
    const back = logMark()
    await setDebugLevel(was)
    await levelSetSince(back, was, "the original level in the phone's service log")
    touched.debugLevel = undefined
    await step('Detailed logging put back')
  })

  it('Advanced > Toggle Runtime Stats: the overlay and the perf row on, through a relaunch, and off again', async function () {
    // worst case (s): smoke 1, ask 22, more 50, the anchor 6, the reads 2, step 2; open 126, the
    // developer controls 65, tapButton 7, calledOnce 14, the overlay 20, settles 52, step 2, more 50,
    // the perf row 6, step 2; relaunched 291, the overlay 20, settles 52, step 2; open 126, the
    // developer controls 65, tapButton 7, calledOnce 14, the overlay gone 20, settles 52, more 50, the
    // anchor 6, the reads 2, step 2 = 1136
    this.timeout(1_150_000)
    await requireAppIsSmoke()
    check(!(await runtimeStatsEnabled()), 'refusing: runtime stats are already on for the phone (the flow starts from off and leaves them off)')

    // off: the More list draws its Crypto row and no perf row, and there is no overlay
    const statsOff = async (what: string) => {
      await openMore()
      // the Crypto row anchors the perf row's absence in the same read
      const drawn = await waitFor('the More list Crypto row', async () => {
        const d = await moreListDraws()
        return d.crypto > 0 ? d : undefined
      }, {interval: 250, timeout: 5_000})
      check(drawn.perf === 0, `the More list draws the perf row ${what}`)
      check(!(await el(T.RUNTIME_STATS).isExisting()), `the runtime stats overlay is drawn ${what}`)
    }
    await statsOff('before the test')
    await step('No runtime stats')
    touched.runtimeStats = true

    // The developer controls, from 7 taps on the warning line's own text (never a container around
    // it), once its rect is seen clear of the DB Nuke and Clear Logs buttons below it. Bound: DB Nuke
    // dragged on screen 20, the line 20 and its read 1, the buttons 2, 7 taps 7, the button 15 = 65.
    const developerControls = async () => {
      const line = `-ios predicate string:type == "XCUIElementTypeStaticText" AND label == "${DEVELOPER_LINE.replace(/"/g, '\\"')}" AND visible == 1`
      // DB Nuke first: it sits under the line, so both are drawn for the overlap check
      await dragUntilOnScreen('the DB Nuke button', () =>
        browser.$('-ios predicate string:type == "XCUIElementTypeButton" AND label == "DB Nuke" AND visible == 1')
      )
      await dragUntilOnScreen('the developer warning line', () => browser.$(line))
      const text = await labelledElement(line, DEVELOPER_LINE, 'the developer warning line')
      const lineRect = await rectOf(text)
      check(lineRect !== undefined, 'the developer line has no frame, so it cannot be seen clear of the buttons')
      for (const label of ['DB Nuke', 'Clear Logs']) {
        const button = await labelledElement(BUTTON_ELEMENTS, label, `the ${label} button`).catch(() => undefined)
        check(label !== 'DB Nuke' || button !== undefined, 'the DB Nuke button is not drawn, so the developer line cannot be seen clear of it')
        if (!button) continue
        // a drawn button with no frame cannot be seen clear of the line
        const at = await rectOf(button)
        check(at !== undefined, `the ${label} button has no frame, so the developer line cannot be seen clear of it`)
        check(!rectsOverlap(lineRect!, at!), `refusing to tap the developer line: it overlaps the ${label} button`)
      }
      for (let i = 0; i < DEVELOPER_TAPS; i++) await text.click()
      await dragUntilOnScreen('Toggle Runtime Stats', () =>
        browser.$('-ios predicate string:type == "XCUIElementTypeButton" AND label == "Toggle Runtime Stats" AND visible == 1')
      )
    }
    const toggle = async () => {
      const seq = await currentCallSeq()
      await tapButton('Toggle Runtime Stats', 'the Toggle Runtime Stats button')
      await calledOnce(seq, TOGGLE_STATS, 'the runtime stats toggle')
    }

    await openAdvanced()
    await developerControls()
    await toggle()
    await el(T.RUNTIME_STATS).waitForExist({timeout: 20_000, timeoutMsg: 'the runtime stats overlay never showed'})
    await settles('the runtime stats setting on', runtimeStatsEnabled, true)
    await step('Runtime stats on', {card: true})
    await openMore()
    await waitFor('the More list perf row', async () => ((await moreListDraws()).perf === 1 ? true : undefined), {interval: 250, timeout: 5_000})
    await step('The perf row in the More list')

    // the setting is kept in the phone's service config, so a relaunch starts them again
    await relaunchOnSmoke()
    await el(T.RUNTIME_STATS).waitForExist({timeout: 20_000, timeoutMsg: 'the runtime stats overlay never showed after a relaunch'})
    await settles('the runtime stats setting on after a relaunch', runtimeStatsEnabled, true)
    creditSurface('relaunch')
    await step('Runtime stats after a relaunch')

    await openAdvanced()
    await developerControls()
    await toggle()
    await el(T.RUNTIME_STATS).waitForExist({reverse: true, timeout: 20_000, timeoutMsg: 'the runtime stats overlay stayed after the toggle'})
    await settles('the runtime stats setting off', runtimeStatsEnabled, false)
    await statsOff('after the toggle')
    touched.runtimeStats = undefined
    await step('Runtime stats off')
  })
})
