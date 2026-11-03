// Settings that save: each case reads what the account (or the service) has, sets the other value
// in the app, reloads the app and reads it back, puts the original back through the app, and reads
// that back after another reload. A cleanup step then puts the original back through the service
// whatever the case did, and checks it. The second account's "Always stay logged in" is in
// settings-remember-password.test.ts, which never traces.
import * as fs from 'fs'
import * as path from 'path'
import type {Page} from '@playwright/test'
import {loadE2EEnv} from '@/tests/e2e/accounts/env'
import {KBFS_START_COMMAND} from '@/tests/e2e/electron/release-lib'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {expectPersists, reloadKeepingCoverage} from '@/tests/e2e/electron/helpers/persisted'
import {
  clickCheckbox,
  isChecked,
  openAdvanced,
  openChat,
  openDisplay,
  openNotifications,
  openThen,
  radio,
  selectedOf,
  serviceSays,
  settingsPage,
  shownOnceLoaded,
} from '@/tests/e2e/electron/helpers/settings'
import {step} from '@/tests/e2e/electron/helpers/step'
import {mainRpc} from '@/tests/e2e/shared/main-rpc'
import * as T from '@/tests/e2e/shared/test-ids'

test.use({actionTimeout: 10_000})
// two reloads and two saves, each read back
test.describe.configure({timeout: 120_000})

// -- chat ----------------------------------------------------------------------------------------

type UnfurlSettings = {blocklist?: Array<string> | null; mode: number; whitelist?: Array<string> | null}
const unfurlModeLabel: Record<number, string> = {0: 'Allow all', 1: 'Disallow all', 2: 'Ask per domain'}
const unfurlSettings = async () => mainRpc<UnfurlSettings>('chat.1.local.getUnfurlSettings', {})
const sortedLists = (s: UnfurlSettings) => ({
  blocklist: [...(s.blocklist ?? [])].sort(),
  mode: s.mode,
  whitelist: [...(s.whitelist ?? [])].sort(),
})
const shownUnfurlMode = async (page: Page) =>
  shownOnceLoaded(
    async () => selectedOf(settingsPage(page, T.SETTINGS_CHAT), Object.values(unfurlModeLabel)),
    async () => unfurlModeLabel[(await unfurlSettings()).mode],
    'the link preview mode'
  )

const saveUnfurlMode = async (page: Page, label: string, mode: number) => {
  await radio(settingsPage(page, T.SETTINGS_CHAT), label).click()
  await page.getByTestId(T.SETTINGS_UNFURL_SAVE).click()
  await serviceSays(async () => (await unfurlSettings()).mode, mode, `the link preview mode after saving "${label}"`)
}

test('Chat > link previews mode', async ({page}, testInfo) => {
  const original = await unfurlSettings()
  const originalLabel = unfurlModeLabel[original.mode] ?? ''
  if (!originalLabel) throw new Error(`unknown link preview mode ${original.mode}`)
  const other = original.mode === 0 ? 1 : 0
  const otherLabel = unfurlModeLabel[other] ?? ''
  await withCleanup(
    async () => {
      await openChat(page)
      expect(await shownUnfurlMode(page), 'the mode shown').toBe(originalLabel)
      await saveUnfurlMode(page, otherLabel, other)
      await step(page, testInfo, 'link previews changed', {card: true})
      await expectPersists(page, async () => openThen(page, openChat, async () => shownUnfurlMode(page)), otherLabel, 'the link preview mode')
      await saveUnfurlMode(page, originalLabel, original.mode)
      await expectPersists(page, async () => openThen(page, openChat, async () => shownUnfurlMode(page)), originalLabel, 'the restored link preview mode')
      await step(page, testInfo, 'link previews restored')
    },
    [
      async () => {
        await mainRpc('chat.1.local.saveUnfurlSettings', {
          blocklist: original.blocklist ?? [],
          mode: original.mode,
          whitelist: original.whitelist ?? [],
        })
        expect(sortedLists(await unfurlSettings()), 'the link preview settings after the restore').toEqual(sortedLists(original))
      },
    ]
  )
})

type ContactSettings = {allowFolloweeDegrees: number; allowGoodTeams: boolean; enabled: boolean; teams?: unknown}
// without the server's version, which a save does not take
const contactSettings = async (): Promise<ContactSettings> => {
  const {allowFolloweeDegrees, allowGoodTeams, enabled, teams} = await mainRpc<ContactSettings>('keybase.1.account.userGetContactSettings', {})
  return {allowFolloweeDegrees, allowGoodTeams, enabled, teams}
}
const contactLabel = 'Only let someone message you or add you to a team if...'
const shownContactEnabled = async (page: Page) =>
  shownOnceLoaded(
    async () => isChecked(settingsPage(page, T.SETTINGS_CHAT), contactLabel),
    async () => (await contactSettings()).enabled,
    'who may message you'
  )

const saveContactEnabled = async (page: Page, enabled: boolean) => {
  const chat = settingsPage(page, T.SETTINGS_CHAT)
  if ((await shownContactEnabled(page)) !== enabled) await clickCheckbox(chat, contactLabel)
  await chat
    .locator('div')
    .filter({has: page.getByText(contactLabel, {exact: true})})
    .filter({has: page.getByText('Save', {exact: true})})
    .last()
    .getByText('Save', {exact: true})
    .click()
  await serviceSays(async () => (await contactSettings()).enabled, enabled, 'who may message you, from the service')
}

test('Chat > who may message you', async ({page}, testInfo) => {
  const original = await contactSettings()
  await withCleanup(
    async () => {
      await openChat(page)
      expect(await shownContactEnabled(page), 'the setting shown').toBe(original.enabled)
      await saveContactEnabled(page, !original.enabled)
      await step(page, testInfo, 'contact setting changed', {card: true})
      await expectPersists(page, async () => openThen(page, openChat, async () => shownContactEnabled(page)), !original.enabled, 'who may message you')
      await saveContactEnabled(page, original.enabled)
      await expectPersists(page, async () => openThen(page, openChat, async () => shownContactEnabled(page)), original.enabled, 'who may message you, restored')
    },
    [
      async () => {
        await mainRpc('keybase.1.account.userSetContactSettings', {settings: original})
        expect(await contactSettings(), 'the contact settings after the restore').toEqual(original)
      },
    ]
  )
})

// -- notifications -------------------------------------------------------------------------------

type GlobalNotif = {settings?: Record<string, boolean> | null}
const globalNotif = async () => mainRpc<GlobalNotif>('chat.1.local.getGlobalAppNotificationSettingsLocal', {})
// GlobalAppNotificationSetting.plaintextdesktop
const plaintextDesktop = '2'
const plaintextDesktopLabel = 'Show message content in computer chat notifications'
const shownPlaintext = async (page: Page) =>
  shownOnceLoaded(
    async () => isChecked(settingsPage(page, T.SETTINGS_CHAT), plaintextDesktopLabel),
    async () => !!(await globalNotif()).settings?.[plaintextDesktop],
    'message content in computer notifications'
  )

const togglePlaintext = async (page: Page, want: boolean) => {
  await clickCheckbox(settingsPage(page, T.SETTINGS_CHAT), plaintextDesktopLabel)
  await serviceSays(async () => !!(await globalNotif()).settings?.[plaintextDesktop], want, 'message content in computer notifications, from the service')
}

test('Notifications > chat: message content in computer notifications', async ({page}, testInfo) => {
  const original = await globalNotif()
  const was = !!original.settings?.[plaintextDesktop]
  await withCleanup(
    async () => {
      await openChat(page)
      expect(await shownPlaintext(page), 'the setting shown').toBe(was)
      await togglePlaintext(page, !was)
      await step(page, testInfo, 'chat notification setting changed', {card: true})
      await expectPersists(page, async () => openThen(page, openChat, async () => shownPlaintext(page)), !was, 'message content in computer notifications')
      await togglePlaintext(page, was)
      await expectPersists(page, async () => openThen(page, openChat, async () => shownPlaintext(page)), was, 'message content in computer notifications, restored')
    },
    [
      async () => {
        await mainRpc('chat.1.local.setGlobalAppNotificationSettingsLocal', {settings: original.settings ?? {}})
        expect((await globalNotif()).settings ?? {}, 'the chat notification settings after the restore').toEqual(original.settings ?? {})
      },
    ]
  )
})

type Subscriptions = {notifications: Record<string, {settings: Array<{description: string; name: string; subscribed: boolean}>; unsub: boolean}>}
const subscriptions = async () => {
  const res = await mainRpc<{body: string}>('keybase.1.apiserver.GetWithSession', {args: [], endpoint: 'account/subscriptions'})
  return JSON.parse(res.body) as Subscriptions
}
const emailSetting = async (name: string) => {
  const s = (await subscriptions()).notifications['email']?.settings.find(x => x.name === name)
  if (!s) throw new Error(`no email notification setting ${name}`)
  return s.subscribed
}

test('Notifications > email subscription', async ({page}, testInfo) => {
  const email = (await subscriptions()).notifications['email']
  const first = email?.settings[0]
  if (!email || !first) throw new Error('the account has no email notification settings (it needs an email address)')
  if (email.unsub) throw new Error('the account is unsubscribed from all email notifications, so its settings cannot be toggled')
  const {description, name, subscribed: was} = first
  // the phone group lists the same settings: the email group is the one with its unsubscribe box
  const notifications = () =>
    settingsPage(page, T.SETTINGS_NOTIFICATIONS)
      .locator('div')
      .filter({has: page.getByText('Email notifications', {exact: true})})
      .filter({has: page.getByText('Unsubscribe from all email notifications', {exact: true})})
      .last()
  const shown = async () => openThen(page, openNotifications, async () => shownOnceLoaded(async () => isChecked(notifications(), description), async () => emailSetting(name), `the email notification "${description}"`)
  )
  const toggle = async (want: boolean) => {
    await clickCheckbox(notifications(), description)
    await serviceSays(async () => emailSetting(name), want, `the email notification "${description}", from the server`)
  }
  await withCleanup(
    async () => {
      expect(await shown(), 'the setting shown').toBe(was)
      await toggle(!was)
      await step(page, testInfo, 'email subscription changed', {card: true})
      await expectPersists(page, shown, !was, `the email notification "${description}"`)
      await toggle(was)
      await expectPersists(page, shown, was, `the email notification "${description}", restored`)
    },
    [
      async () => {
        if ((await emailSetting(name)) === was) return
        await mainRpc('keybase.1.apiserver.PostJSON', {
          JSONPayload: [{key: `${name}|email`, value: was ? '1' : '0'}],
          args: [],
          endpoint: 'account/subscribe',
        })
        expect(await emailSetting(name), `the email notification "${description}" after the restore`).toBe(was)
      },
    ]
  )
})

// -- display -------------------------------------------------------------------------------------

const animatedLabel = 'Allow animated emoji'
// turning animated emoji off keeps a gregor item of this category
const animatedAllowed = async () =>
  !(await mainRpc<{items?: Array<{item?: {category?: string} | null}> | null}>('keybase.1.gregor.getState', {})).items?.some(
    i => i.item?.category === 'emojianimations'
  )

test('Display > animated emoji', async ({page}, testInfo) => {
  const shown = async () => openThen(page, openDisplay, async () => shownOnceLoaded(async () => isChecked(settingsPage(page, T.SETTINGS_DISPLAY), animatedLabel), animatedAllowed, 'allow animated emoji')
  )
  const was = await shown()
  await withCleanup(
    async () => {
      await clickCheckbox(settingsPage(page, T.SETTINGS_DISPLAY), animatedLabel)
      await expect.poll(async () => isChecked(settingsPage(page, T.SETTINGS_DISPLAY), animatedLabel), {message: 'the checkbox after the toggle'}).toBe(!was)
      await step(page, testInfo, 'animated emoji changed', {card: true})
      await expectPersists(page, shown, !was, 'allow animated emoji')
      await clickCheckbox(settingsPage(page, T.SETTINGS_DISPLAY), animatedLabel)
      await expect.poll(async () => isChecked(settingsPage(page, T.SETTINGS_DISPLAY), animatedLabel), {message: 'the checkbox after the restore'}).toBe(was)
      await expectPersists(page, shown, was, 'allow animated emoji, restored')
    },
    [
      async () => {
        await mainRpc('chat.1.local.toggleEmojiAnimations', {enabled: was})
        await expect.poll(animatedAllowed, {message: 'allow animated emoji after the restore', timeout: 10_000}).toBe(was)
      },
    ]
  )
})

type ConfigValue = {isNull: boolean; b?: boolean | null; s?: string | null}
// What the GUI config holds at `path`, or undefined when nothing is set there.
const guiValue = async (path: string): Promise<ConfigValue | undefined> => {
  try {
    const v = await mainRpc<ConfigValue>('keybase.1.config.guiGetValue', {path})
    return v.isNull ? undefined : v
  } catch (e) {
    if (/no such key/i.test(String(e))) return undefined
    throw e
  }
}
const restoreGuiValue = async (path: string, original: ConfigValue | undefined) => {
  if (original) await mainRpc('keybase.1.config.guiSetValue', {path, value: original})
  else await mainRpc('keybase.1.config.guiClearValue', {path})
  expect(await guiValue(path), `${path} after the restore`).toEqual(original)
}

const themeLabel: Record<string, string> = {alwaysLight: 'Light', system: 'Respect system settings'}

// Light only: the flows run in light mode, so the theme moves between the light theme and the
// system's, which is light on this machine, and never to dark.
test('Display > theme', async ({page}, testInfo) => {
  const original = await guiValue('ui.darkMode')
  const was = original?.s ?? 'system'
  const wasLabel = themeLabel[was]
  if (!wasLabel) throw new Error(`the theme is ${was}; this flow runs only from a light theme`)
  const other = was === 'system' ? 'alwaysLight' : 'system'
  const otherLabel = themeLabel[other] ?? ''
  const display = () => settingsPage(page, T.SETTINGS_DISPLAY)
  const labels = [...Object.values(themeLabel), 'Dark']
  const shown = async () => openThen(page, openDisplay, async () => shownOnceLoaded(async () => selectedOf(display(), labels), async () => themeLabel[(await guiValue('ui.darkMode'))?.s ?? 'system'], 'the theme')
  )
  const choose = async (label: string, value: string) => {
    await radio(display(), label).click()
    await serviceSays(async () => (await guiValue('ui.darkMode'))?.s, value, `ui.darkMode after choosing "${label}"`)
  }
  await withCleanup(
    async () => {
      expect(await shown(), 'the theme shown').toBe(wasLabel)
      await choose(otherLabel, other)
      await step(page, testInfo, 'theme changed', {card: true})
      await expectPersists(page, shown, otherLabel, 'the theme')
      await choose(wasLabel, was)
      await expectPersists(page, shown, wasLabel, 'the theme, restored')
    },
    [async () => restoreGuiValue('ui.darkMode', original)]
  )
})

const smallNavLabel = 'Force small navigation'

test('Display > force small navigation', async ({page}, testInfo) => {
  const original = await guiValue('ui.forceSmallNav')
  const was = !!original?.b
  const display = () => settingsPage(page, T.SETTINGS_DISPLAY)
  const shown = async () => openThen(page, openDisplay, async () => shownOnceLoaded(async () => isChecked(display(), smallNavLabel), async () => !!(await guiValue('ui.forceSmallNav'))?.b, 'force small navigation')
  )
  const toggle = async (want: boolean) => {
    await clickCheckbox(display(), smallNavLabel)
    await serviceSays(async () => !!(await guiValue('ui.forceSmallNav'))?.b, want, 'ui.forceSmallNav')
  }
  await withCleanup(
    async () => {
      expect(await shown(), 'the setting shown').toBe(was)
      await toggle(!was)
      await step(page, testInfo, 'small navigation changed', {card: true})
      await expectPersists(page, shown, !was, 'force small navigation')
      await toggle(was)
      await expectPersists(page, shown, was, 'force small navigation, restored')
    },
    [async () => restoreGuiValue('ui.forceSmallNav', original)]
  )
})

// -- advanced ------------------------------------------------------------------------------------

// The KBFS log the release run starts kbfsfuse with; the level is read from its "Setting Vdebug"
// lines, since the service has no call that returns it.
const kbfsLog = /-log-file (\S+)/.exec(KBFS_START_COMMAND)?.[1] ?? ''
// a level set, or kbfsfuse starting (at its default, vlog0)
const vdebugRe = /Setting Vdebug to "([^"]*)"|\bKBFS version \S+$/gm
// The log and its rotated copies (`<log>-<from>-<to>`, which sort oldest first), newest first.
const kbfsLogs = () => {
  const dir = path.dirname(kbfsLog)
  const base = path.basename(kbfsLog)
  const rotated = fs
    .readdirSync(dir)
    .filter(n => n.startsWith(`${base}-`))
    .sort()
    .reverse()
  return [kbfsLog, ...rotated.map(n => path.join(dir, n))]
}
// The KBFS verbose log level: the last one set since kbfsfuse started, or vlog0 (its default). A
// level set before the log rotated is only in an older copy, so those are read, newest first, until
// one sets a level or shows kbfsfuse starting.
const kbfsVLevel = () => {
  for (const file of kbfsLogs()) {
    const last = [...fs.readFileSync(file, 'utf8').matchAll(vdebugRe)].at(-1)
    if (last) return last[1] || 'vlog0'
  }
  return 'vlog0'
}

test('Advanced > KBFS detailed logging', async ({page}, testInfo) => {
  if (!fs.existsSync(kbfsLog)) throw new Error(`the KBFS log ${kbfsLog} is not there (kbfsfuse runs as: ${KBFS_START_COMMAND})`)
  const was = kbfsVLevel()
  if (was === 'vlog2') throw new Error('KBFS detailed logging is already on, so the button cannot be seen to turn it on')
  const read = async () => openThen(page, openAdvanced, () => kbfsVLevel())
  await withCleanup(
    async () => {
      await openAdvanced(page)
      await settingsPage(page, T.SETTINGS_ADVANCED).getByText('Enable Detailed Logging', {exact: true}).click()
      await expect.poll(kbfsVLevel, {message: 'the KBFS log level after the button', timeout: 20_000}).toBe('vlog2')
      await step(page, testInfo, 'detailed logging on', {card: true})
      await expectPersists(page, read, 'vlog2', 'the KBFS log level')
      // the app has no control that turns it off
      await mainRpc('keybase.1.SimpleFS.simpleFSSetDebugLevel', {level: was})
      await expectPersists(page, read, was, 'the KBFS log level, restored')
    },
    [
      async () => {
        if (kbfsVLevel() === was) return
        await mainRpc('keybase.1.SimpleFS.simpleFSSetDebugLevel', {level: was})
        await expect.poll(kbfsVLevel, {message: 'the KBFS log level after the restore', timeout: 20_000}).toBe(was)
      },
    ]
  )
})

const lockdownLabel = 'Enable account lockdown mode'
const lockdown = async () => (await mainRpc<{status: boolean}>('keybase.1.account.getLockdownMode', {sessionID: 0})).status

test('Advanced > lockdown mode', async ({page}, testInfo) => {
  const was = await lockdown()
  if (was) throw new Error('lockdown mode is on for the smoke account; the flow starts from off and leaves it off')
  const advanced = () => settingsPage(page, T.SETTINGS_ADVANCED)
  const shown = async () => openThen(page, openAdvanced, async () => shownOnceLoaded(async () => isChecked(advanced(), lockdownLabel), lockdown, 'lockdown mode'))
  const toggle = async (want: boolean) => {
    await clickCheckbox(advanced(), lockdownLabel)
    await serviceSays(lockdown, want, 'lockdown mode, from the server')
  }
  await withCleanup(
    async () => {
      expect(await shown(), 'the setting shown').toBe(false)
      await toggle(true)
      await step(page, testInfo, 'lockdown on', {card: true})
      await expectPersists(page, shown, true, 'lockdown mode')
      await toggle(false)
      await expectPersists(page, shown, false, 'lockdown mode, restored')
    },
    [
      async () => {
        if (!(await lockdown())) return
        await mainRpc('keybase.1.account.setLockdownMode', {enabled: false, sessionID: 0})
        expect(await lockdown(), 'lockdown mode after the restore').toBe(false)
      },
    ]
  )
})

// The developer controls show after the warning line is clicked this many times (settings/advanced.tsx).
const developerClicks = 7

// Whether the service is sending runtime stats: while on it logs an update every 4s
// (go/runtimestats/stats.go), and the service has no call that says.
const serviceLog = () => loadE2EEnv().serviceLog ?? '/tmp/kb-e2e/service.log'
const lastStatsUpdate = () => {
  const fd = fs.openSync(serviceLog(), 'r')
  try {
    const size = fs.fstatSync(fd).size
    const len = Math.min(size, 4 * 1024 * 1024)
    const buf = Buffer.alloc(len)
    fs.readSync(fd, buf, 0, len, size - len)
    const line = buf
      .toString('utf8')
      .split('\n')
      .findLast(l => l.includes('RuntimeStats.Runner: update'))
    return line ? Date.parse(line.slice(0, line.indexOf(' '))) : 0
  } finally {
    fs.closeSync(fd)
  }
}
const statsRunning = () => Date.now() - lastStatsUpdate() < 6_000

test('Advanced > runtime stats overlay shows, then hides', async ({page}, testInfo) => {
  const overlay = page.getByTestId(T.RUNTIME_STATS)
  await expect(overlay, 'no runtime stats overlay before the flow').toHaveCount(0)
  await withCleanup(
    async () => {
      await openAdvanced(page)
      const warning = settingsPage(page, T.SETTINGS_ADVANCED).getByText("Please don't do anything below here unless instructed to by a developer.", {exact: true})
      for (let i = 0; i < developerClicks; i++) await warning.click()
      const button = settingsPage(page, T.SETTINGS_ADVANCED).getByText('Toggle Runtime Stats', {exact: true})
      await button.click()
      await expect.poll(statsRunning, {message: 'the service sends runtime stats', timeout: 20_000}).toBe(true)
      await expect(overlay, 'the runtime stats overlay').toBeVisible({timeout: 20_000})
      await step(page, testInfo, 'runtime stats shown', {card: true})
      await button.click()
      await expect(overlay, 'the runtime stats overlay after the second toggle').toHaveCount(0, {timeout: 20_000})
      // a renderer that went blank also has no overlay
      await expect(page.getByTestId(T.NAV_TAB_CHAT), 'the app still renders after the overlay hides').toBeVisible()
      await step(page, testInfo, 'runtime stats hidden')
    },
    [
      async () => {
        // stats turned off a moment ago still show a recent update until it ages out
        const stopped = async () =>
          expect
            .poll(statsRunning, {intervals: [500], timeout: 10_000})
            .toBe(false)
            .then(() => true)
            .catch(() => false)
        if (await stopped()) return
        await mainRpc('keybase.1.config.toggleRuntimeStats', {})
        expect(await stopped(), 'the service stopped sending runtime stats after the restore').toBe(true)
      },
      async () => {
        if (await page.getByTestId(T.NAV_TAB_CHAT).isVisible()) return
        // a renderer that died under the overlay is reloaded so the next test meets the app
        await reloadKeepingCoverage(page)
      },
    ]
  )
})

type ProxyData = {addressWithPort: string; certPinning: boolean; proxyType: number}
const proxyLabel: Record<number, string> = {0: 'No proxy', 1: 'HTTP(s) Connect', 2: 'SOCKS5'}
const proxyData = async () => mainRpc<ProxyData>('keybase.1.config.getProxyData', {})

test('Advanced > proxy settings save and keep their mode', async ({page}, testInfo) => {
  const original = await proxyData()
  const label = proxyLabel[original.proxyType]
  if (!label) throw new Error(`unknown proxy type ${original.proxyType}`)
  const advanced = () => settingsPage(page, T.SETTINGS_ADVANCED)
  const shown = async () => openThen(page, openAdvanced, async () => shownOnceLoaded(async () => selectedOf(advanced(), Object.values(proxyLabel)), async () => proxyLabel[(await proxyData()).proxyType], 'the proxy mode')
  )
  await withCleanup(
    async () => {
      expect(await shown(), 'the proxy mode shown').toBe(label)
      await advanced().getByText('Save Proxy Settings', {exact: true}).click()
      // the save writes the form back: the same mode and pinning, and the address as the form holds
      // it (one with no port gets the form's default, 8080)
      const written = original.addressWithPort.includes(':') ? original.addressWithPort : `${original.addressWithPort}:8080`
      await serviceSays(proxyData, {...original, addressWithPort: written}, 'the proxy settings after Save')
      await step(page, testInfo, 'proxy saved', {card: true})
      await expectPersists(page, shown, label, 'the proxy mode')
    },
    [
      async () => {
        await mainRpc('keybase.1.config.setProxyData', {proxyData: original})
        expect(await proxyData(), 'the proxy settings after the restore').toEqual(original)
      },
    ]
  )
})
