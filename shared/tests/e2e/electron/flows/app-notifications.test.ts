// A message from the second account, arriving while the app shows another tab, makes a desktop
// notification naming the sender and carrying the message. The main process records it instead of
// showing it (main-process.ts); the macOS toast itself and its click are a manual edge. The
// notification carries the message only with "Show message content in computer chat
// notifications" on, and the service flags it for a desktop notification only while the
// conversation's desktop setting is "On any activity": the test turns each on when it is off (setup)
// and puts it back after.
import type {Page} from '@playwright/test'
import {loadE2EAccounts} from '@/tests/e2e/accounts/env'
import {sendAsSecond} from '@/tests/e2e/electron/helpers/chat'
import {e2eMarker, expect, seedChatData, test} from '@/tests/e2e/electron/helpers/fixtures'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {connectMainProcess} from '@/tests/e2e/electron/helpers/main-process'
import {navigateToPeople} from '@/tests/e2e/electron/helpers/navigate'
import {manualEdge, step} from '@/tests/e2e/electron/helpers/step'
import type {ChatData} from '@/tests/e2e/shared/chat-data'
import {convIDBytes} from '@/tests/e2e/shared/conv-id'
import {mainConversation, mainRpc} from '@/tests/e2e/shared/main-rpc'
import {requireMainIsSmoke} from '@/tests/e2e/shared/peer-service'

let data: ChatData

test.beforeAll(async () => {
  test.setTimeout(20 * 60_000) // a first run seeds; later runs only check
  data = await seedChatData()
})

test.afterEach(async () => {
  await requireMainIsSmoke(loadE2EAccounts())
})

type ShellStore = {getState: () => {desktopNotifications: boolean; desktopNotificationsLoaded: boolean}}
// The app's desktop notifications setting (Settings > Notifications), once loaded from the service.
const desktopNotificationsSetting = async (page: Page) =>
  page.evaluate(() => {
    const s = ((globalThis as unknown as {__ZUSTAND_HMR__?: Map<string, unknown>}).__ZUSTAND_HMR__?.get('shell') as ShellStore | undefined)?.getState()
    if (!s) throw new Error('the shell store is not in __ZUSTAND_HMR__; is this a dev build?')
    return s.desktopNotificationsLoaded ? s.desktopNotifications : undefined
  })

type GlobalNotif = {settings?: Record<string, boolean> | null}
const globalNotif = async () => mainRpc<GlobalNotif>('chat.1.local.getGlobalAppNotificationSettingsLocal', {})
// GlobalAppNotificationSetting.plaintextdesktop
const plaintextDesktop = '2'

// the conversation's notification settings, keyed DeviceType then NotificationKind: desktop / generic
const desktop = '0'
const generic = '0'
type ConvNotif = {channelWide: boolean; settings: Record<string, Record<string, boolean>>}
const convNotif = async (convID: string): Promise<ConvNotif> => {
  const n = (await mainConversation(convID)).notifications
  return {channelWide: n?.channelWide ?? false, settings: n?.settings ?? {}}
}
const setConvNotif = async (convID: string, n: ConvNotif) => {
  const settings = Object.entries(n.settings).flatMap(([deviceType, kinds]) =>
    Object.entries(kinds).map(([kind, enabled]) => ({deviceType: Number(deviceType), enabled, kind: Number(kind)}))
  )
  await mainRpc('chat.1.local.setAppNotificationSettingsLocal', {channelWide: n.channelWide, convID: convIDBytes(convID), settings})
}

test('an incoming message fires a desktop notification', async ({page}, testInfo) => {
  test.setTimeout(90_000)
  const {secondUser} = data
  const original = await globalNotif()
  const {convID} = data.direct
  const originalConv = await convNotif(convID)
  await withCleanup(
    async () => {
      if (!originalConv.settings[desktop]?.[generic]) {
        await setConvNotif(convID, {...originalConv, settings: {...originalConv.settings, [desktop]: {...originalConv.settings[desktop], [generic]: true}}})
        await expect
          .poll(async () => !!(await convNotif(convID)).settings[desktop]?.[generic], {message: 'the conversation notifies the desktop on any activity', timeout: 10_000})
          .toBe(true)
      }
      if (!original.settings?.[plaintextDesktop]) {
        await mainRpc('chat.1.local.setGlobalAppNotificationSettingsLocal', {settings: {...original.settings, [plaintextDesktop]: true}})
        await expect.poll(async () => !!(await globalNotif()).settings?.[plaintextDesktop], {message: 'message content in computer notifications, on', timeout: 10_000}).toBe(true)
      }
      await expect
        .poll(async () => desktopNotificationsSetting(page), {message: 'the desktop notifications setting (it must be on for this test)', timeout: 10_000})
        .toBe(true)
      const mp = await connectMainProcess()
      await mp.recordNotifications()
      // not looking at the conversation, so the app notifies
      await navigateToPeople(page)
      const text = e2eMarker('notify')
      await sendAsSecond(data.direct.convID, text)
      const got: Array<{title: string; body: string}> = []
      await expect
        .poll(
          async () => {
            got.push(...(await mp.takeNotifications()))
            return got.find(n => n.body.includes(text))
          },
          {message: "the notification for second's message", timeout: 20_000}
        )
        .toMatchObject({title: secondUser})
      await step(page, testInfo, 'notification recorded', {card: true})
      await manualEdge(page, testInfo, 'os-notification')
    },
    [
      async () => {
        await mainRpc('chat.1.local.setGlobalAppNotificationSettingsLocal', {settings: original.settings ?? {}})
        await expect
          .poll(async () => (await globalNotif()).settings ?? {}, {message: 'the chat notification settings after the restore', timeout: 10_000})
          .toEqual(original.settings ?? {})
      },
      async () => {
        if (!!(await convNotif(convID)).settings[desktop]?.[generic] === !!originalConv.settings[desktop]?.[generic]) return
        await setConvNotif(convID, originalConv)
        await expect
          .poll(async () => (await convNotif(convID)).settings, {message: "the conversation's notification settings after the restore", timeout: 10_000})
          .toEqual(originalConv.settings)
      },
    ]
  )
})
