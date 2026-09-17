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
const waitForBackground = async (goMark: ReturnType<typeof goLogMark>) =>
  waitForLinesInOrder('the app to enter the background', () => goLogSince(goMark), [/lifecycle: didEnterBackground: /])

const onProfile = (s: Awaited<ReturnType<typeof appSnapshot>>['screen']) =>
  s?.name === 'profile' && s.params?.['username'] === profileLink.username

// Log lines these flows rely on:
// - Metro (JS): "[Startup] loadStartupDetails: Linking.getInitialURL returned in <n>ms: <url>" for
//   a cold deep link; "[onNotification]: <payload>" for each push JS receives, whose payload
//   carries native's "userInteraction"; "[Push] handleLoudMessage: ignore non userInteraction"
//   when JS declines to navigate for an untapped push.
// - Go (ios.log): "lifecycle: didEnterBackground: " before a push is sent to a backgrounded app,
//   so it can't arrive while the app is still in the foreground (and not be shown).
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
    const metroMark0 = metroLogMark()
    const convID = await openSelfConversation(user)
    // Leave on People and background once, so the route the app saves and would restore on
    // launch is not the conversation the link opens.
    await escapeToTabs()
    await navigateToPeople()
    const goMark = goLogMark()
    await backgroundApp()
    await waitForBackground(goMark)
    await waitForLinesInOrder('JS to see the background', () => metroClientLogSince(metroMark0), [/app focus changed: background/])
    await terminateApp()
    const metroMark = metroLogMark()
    const url = `keybase://convid/${convID}`
    openUrl(url)
    await waitForAppState('active', undefined, 90000)
    await waitForScreen('the linked conversation', s => s?.name === 'chatConversation' && s.params?.['conversationIDKey'] === convID)
    const startup = findLines(metroClientLogSince(metroMark), /Linking\.getInitialURL returned in \d+ms: /)
    expect(startup.at(-1)).toContain(url)
  })
})

describe('app lifecycle: push notifications', () => {
  let convID = ''
  const pushFor = (body: string) => ({
    aps: {alert: {body, title: 'e2e'}, sound: 'default'},
    convID,
    m: '',
    t: '1',
    type: 'chat.newmessage',
  })
  // The payload JS logs for a push, found by its unique body.
  const jsPushes = (lines: Array<string>, body: string) => findLines(lines, /\[onNotification\]/).filter(l => l.includes(body))

  before(async () => {
    const user = requireSmokeUser()
    await waitForAppState('active')
    await ensureNotificationPermission()
    convID = await openSelfConversation(user)
  })

  it('a visible push that arrives in the foreground does not navigate', async () => {
    await waitForAppState('active')
    await navigateToPeople()
    const metroMark = metroLogMark()
    const body = `e2e-push-foreground-${Date.now()}`
    sendPush(pushFor(body))

    const [delivered] = await waitForLinesInOrder('JS to receive the push', () => jsPushes(metroClientLogSince(metroMark), body), [
      /\[onNotification\]/,
    ])
    expect(delivered).toContain('"userInteraction": false')
    await waitForLinesInOrder('JS to decline to navigate', () => metroClientLogSince(metroMark), [
      /\[Push\] handleLoudMessage: ignore non userInteraction/,
    ])
    await browser.pause(3000)
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
    expect(jsPushes(metroClientLogSince(metroMark), body)).toEqual([])
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
    const [delivered] = jsPushes(metroClientLogSince(metroMark), body)
    expect(delivered).toContain('"userInteraction": true')
  })

  it('tapping a push while the app is not running launches into its conversation', async () => {
    await waitForAppState('active')
    await navigateToPeople()
    await terminateApp()
    const metroMark = metroLogMark()
    const body = `e2e-push-cold-${Date.now()}`
    sendPush(pushFor(body))
    expect(await findNotification(body, {tap: true})).toBeDefined()

    await waitForAppState('active', undefined, 90000)
    await waitForScreen('the pushed conversation', s => s?.name === 'chatConversation' && s.params?.['conversationIDKey'] === convID)
    expect(findLines(metroClientLogSince(metroMark), /\[Push\] handleLoudMessage: ignore non userInteraction/)).toEqual([])
  })
})
