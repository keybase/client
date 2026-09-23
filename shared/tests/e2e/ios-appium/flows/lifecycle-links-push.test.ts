import {expect} from '@wdio/globals'
import {requireSmokeUser} from '../helpers/app'
import {el} from '../helpers/elements'
import {escapeToTabs, navigateToPeople} from '../helpers/navigate'
import * as T from '../../shared/test-ids'
import {
  activateApp,
  appSnapshot,
  backgroundApp,
  closeNotificationCenter,
  ensureNotificationPermission,
  findLines,
  findNotification,
  goLogMark,
  goLogSince,
  jsEval,
  metroClientLogSince,
  metroLogMark,
  openSelfConversation,
  openUrl,
  sendPush,
  terminateApp,
  waitFor,
  waitForAppState,
  waitForLinesInOrder,
} from '../helpers/lifecycle'

// A public account safe to deep link to.
const profileLink = {url: 'keybase://profile/show/keybase', username: 'keybase'}

const waitForScreen = async (what: string, match: (s: Awaited<ReturnType<typeof appSnapshot>>['screen']) => boolean) =>
  waitFor(
    what,
    async () => {
      const {screen} = await appSnapshot()
      return match(screen) ? screen : undefined
    },
    {interval: 500, timeout: 30000}
  )

// A push sent before the app is really in the background is handed to the app instead of shown.
// The trailing comma (from Go's "useful update: %v, we are currently in state: %v") keeps this
// from also matching a BACKGROUNDACTIVE transition.
const waitForBackground = async (goMark: ReturnType<typeof goLogMark>) =>
  waitForLinesInOrder('the app to enter the background', () => goLogSince(goMark), [/useful update: BACKGROUND,/])

// Terminating right after navigating can leave the previous screen as the route the app saves
// and restores on launch (routes are saved on a delay, and on backgrounding). Leaving on People
// and backgrounding first makes a cold launch that opens a conversation prove the launch
// input (link or push) did it, not the restored route.
const terminateFromPeople = async () => {
  await escapeToTabs()
  await navigateToPeople()
  const goMark = goLogMark()
  const metroMark = metroLogMark()
  await backgroundApp()
  await waitForBackground(goMark)
  await waitForLinesInOrder('JS to see the background', () => metroClientLogSince(metroMark), [
    /app focus changed: background$/,
  ])
  await terminateApp()
}

const onProfile = (s: Awaited<ReturnType<typeof appSnapshot>>['screen']) =>
  s?.name === 'profile' && s.params?.['username'] === profileLink.username

// Log lines these flows rely on:
// - Metro (JS): "[Startup] loadStartupDetails: Linking.getInitialURL returned in <n>ms: <url>" for
//   a cold deep link; "[PushTap] took a tap link: <link>" for every tap JS takes, cold or warm
//   (only a tap reaches JS at all); "[DeepLink] url event: <url>" for a link opened while running;
//   "[AccountLink] switching accounts" for a tap that switches accounts, which must never appear
//   in these flows.
// - Go (ios.log): "MobileAppState.Update: useful update: BACKGROUND, …" before a push is sent to
//   a backgrounded app, so it can't arrive while the app is still in the foreground (and not be
//   shown).
describe('app lifecycle: deep links', () => {
  it('opens a deep link while running', async () => {
    await waitForAppState('active')
    await navigateToPeople()
    openUrl(profileLink.url)
    await waitForScreen('the linked profile', onProfile)
    await el(T.PROFILE_PAGE).waitForExist({interval: 250, timeout: 15000})
  })

  // A cold profile link is not used here: the router builds its launch state with the profile
  // inside the People tab, where it isn't a screen, so it opens People instead. That is
  // router-v2/linking.tsx behavior, independent of app state; a conversation link is built
  // at the root and exercises the same launch path.
  it('opens a deep link that launches the app', async () => {
    const user = requireSmokeUser()
    await waitForAppState('active')
    const convID = await openSelfConversation(user)
    await terminateFromPeople()
    const metroMark = metroLogMark()
    const url = `keybase://convid/${convID}`
    openUrl(url)
    await waitForAppState('active', undefined, 90000)
    await waitForScreen('the linked conversation', s => s?.name === 'chatConversation' && s.params?.['conversationIDKey'] === convID)
    const startup = findLines(metroClientLogSince(metroMark), /Linking\.getInitialURL returned in \d+ms: /)
    expect(startup.at(-1)).toContain(url)
  })

  it('a link naming another account opens as a plain link and never switches accounts', async () => {
    const user = requireSmokeUser()
    await waitForAppState('active')
    const convID = await openSelfConversation(user)
    await navigateToPeople()
    const uidBefore = await jsEval<string>(`return kbModule('stores/current-user.tsx').useCurrentUserState.getState().uid`)
    const metroMark = metroLogMark()
    // a uid that isn't this account: a link, unlike a tap, can never act on one
    openUrl(`keybase://convid/${convID}?uid=00000000000000000000000000000019`)
    await waitForScreen('the linked conversation', s => s?.name === 'chatConversation' && s.params?.['conversationIDKey'] === convID)
    const lines = metroClientLogSince(metroMark)
    expect(findLines(lines, /\[DeepLink\] url event: /)).toHaveLength(1)
    expect(findLines(lines, /\[AccountLink\]/)).toEqual([])
    expect(findLines(lines, /\[PushTap\] took a tap link: /)).toEqual([])
    await browser.pause(3000)
    expect(await jsEval<string>(`return kbModule('stores/current-user.tsx').useCurrentUserState.getState().uid`)).toBe(uidBefore)
  })
})

describe('app lifecycle: push notifications', () => {
  let convID = ''
  let uid = ''
  // Real pushes name the account they are for; a payload without uid skips the account check.
  const pushFor = (body: string) => ({
    aps: {alert: {body, title: 'e2e'}, sound: 'default'},
    convID,
    m: '',
    t: '1',
    type: 'chat.newmessage',
    uid,
  })
  const tapLink = () => `keybase://convid/${convID}`
  // Every tap JS took. A push that was not tapped produces none.
  const tapLines = (lines: Array<string>) => findLines(lines, /\[PushTap\] took a tap link: /)

  // An empty tapLines result only proves something if the window it's read from definitely
  // captured JS's live console output; a quiet Metro socket or a JS runtime that never ran would
  // pass the same empty check for the wrong reason. console.log goes through the same
  // remote-console path logger.info does (see shared/logger/ring-logger.tsx), so a marker dropped
  // this way is captured by metroClientLogSince exactly like any real log line would be.
  const logMarker = async (): Promise<RegExp> => {
    const token = `e2e-marker-${Date.now()}-${Math.random().toString(36).slice(2)}`
    await jsEval(`console.log(${JSON.stringify(token)}); return true`)
    return new RegExp(token)
  }

  before(async () => {
    const user = requireSmokeUser()
    await waitForAppState('active')
    await ensureNotificationPermission()
    convID = await openSelfConversation(user)
    uid = await jsEval<string>(`return kbModule('stores/current-user.tsx').useCurrentUserState.getState().uid`)
    expect(uid).not.toBe('')
  })

  it('a visible push that arrives in the foreground does not navigate', async () => {
    await waitForAppState('active')
    await navigateToPeople()
    const metroMark = metroLogMark()
    // The app never leaves the foreground in this test, so there's no natural event (like a
    // background/foreground transition) to prove the log window is live; drop one explicitly.
    const marker = await logMarker()
    const body = `e2e-push-foreground-${Date.now()}`
    sendPush(pushFor(body))

    await browser.pause(5000)
    const lines = metroClientLogSince(metroMark)
    expect(findLines(lines, marker).length).toBeGreaterThan(0)
    expect(tapLines(lines)).toEqual([])
    expect((await appSnapshot()).screen?.name).not.toBe('chatConversation')
  })

  it('a push shown in the background but not tapped does not navigate', async () => {
    await waitForAppState('active')
    await navigateToPeople()
    const metroMark = metroLogMark()
    const goMark = goLogMark()
    await backgroundApp()
    await waitForBackground(goMark)
    const body = `e2e-push-untapped-${Date.now()}`
    sendPush(pushFor(body))
    // The notification is really shown, just not tapped.
    const where = await findNotification(body, {tap: false})
    expect(where).toBeDefined()
    if (where === 'center') await closeNotificationCenter()
    await activateApp()

    await waitForAppState('active')
    await browser.pause(3000)
    expect((await appSnapshot()).screen?.name).not.toBe('chatConversation')
    const lines = metroClientLogSince(metroMark)
    // Reactivating always logs "app focus changed: active" (constants/init/index.tsx); requiring
    // it first proves this window captured JS's live output, so an empty tapLines below means no
    // tap happened rather than a JS runtime that silently never resumed logging.
    expect(findLines(lines, /app focus changed: active$/).length).toBeGreaterThan(0)
    expect(tapLines(lines)).toEqual([])
  })

  it('tapping a push shown in the background opens its conversation', async () => {
    await waitForAppState('active')
    await navigateToPeople()
    const metroMark = metroLogMark()
    const goMark = goLogMark()
    await backgroundApp()
    await waitForBackground(goMark)
    const body = `e2e-push-tapped-${Date.now()}`
    sendPush(pushFor(body))
    expect(await findNotification(body, {tap: true})).toBeDefined()

    await waitForAppState('active')
    await waitForScreen('the pushed conversation', s => s?.name === 'chatConversation' && s.params?.['conversationIDKey'] === convID)
    const lines = metroClientLogSince(metroMark)
    // Delivered once, and never through Linking.
    expect(tapLines(lines)).toEqual([expect.stringContaining(tapLink())])
    expect(findLines(lines, /\[DeepLink\] url event: /)).toEqual([])
  })

  it('tapping a push while the app is not running launches into its conversation', async () => {
    await waitForAppState('active')
    await terminateFromPeople()
    const metroMark = metroLogMark()
    const body = `e2e-push-cold-${Date.now()}`
    sendPush(pushFor(body))
    expect(await findNotification(body, {tap: true})).toBeDefined()

    await waitForAppState('active', undefined, 90000)
    await waitForScreen('the pushed conversation', s => s?.name === 'chatConversation' && s.params?.['conversationIDKey'] === convID)
    // The tap reaches JS through the native tap slot and picks the startup route.
    const lines = metroClientLogSince(metroMark)
    expect(tapLines(lines)).toEqual([expect.stringContaining(tapLink())])
    // startup's inbox load can still pick a screen after the route opens; the conversation must stay
    await browser.pause(3000)
    expect((await appSnapshot()).screen?.params?.['conversationIDKey']).toBe(convID)
    expect(findLines(metroClientLogSince(metroMark), /\[AccountLink\]/)).toEqual([])
  })
})
