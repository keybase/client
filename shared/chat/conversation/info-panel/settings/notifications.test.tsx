/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {makeConversationMeta} from '@/constants/chat/meta'
import {flush} from '@/test/flush'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {metasReceived} from '@/chat/inbox/metadata'
import {resetAllStores} from '@/util/zustand'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convID = T.Chat.keyToConversationID(conversationIDKey)
const setSettings = 'chat.1.local.setAppNotificationSettingsLocal'

import Notifications from './notifications'

// The combined desktop/mobile choice the service is sent.
const choice = (desktop: T.Chat.NotificationsType, mobile: T.Chat.NotificationsType) => ({desktop, mobile})

type WireSetting = {deviceType: T.RPCGen.DeviceType; enabled: boolean; kind: T.RPCChat.NotificationKind}

// The choice a setAppNotificationSettingsLocal call carries, read back from its per-device kinds
const sentChoice = (p: {settings: Array<WireSetting>}) => {
  const forDevice = (deviceType: T.RPCGen.DeviceType): T.Chat.NotificationsType => {
    const on = (kind: T.RPCChat.NotificationKind) =>
      p.settings.some(s => s.deviceType === deviceType && s.kind === kind && s.enabled)
    return on(T.RPCChat.NotificationKind.generic)
      ? 'onAnyActivity'
      : on(T.RPCChat.NotificationKind.atmention)
        ? 'onWhenAtMentioned'
        : 'never'
  }
  return choice(forDevice(T.RPCGen.DeviceType.desktop), forDevice(T.RPCGen.DeviceType.mobile))
}

const sent = () =>
  paramsOf(fake, setSettings).map((p: {channelWide: boolean; convID: Uint8Array; settings: Array<WireSetting>}) => ({
    channelWide: p.channelWide,
    convID: p.convID,
    ...sentChoice(p),
  }))

const renderNotifications = (over: Partial<T.Chat.ConversationMeta> = {}) => {
  metasReceived([
    {
      ...makeConversationMeta(),
      conversationIDKey,
      notificationsDesktop: 'onAnyActivity',
      notificationsGlobalIgnoreMentions: false,
      notificationsMobile: 'never',
      trustedState: 'trusted',
      ...over,
    },
  ])
  return render(<Notifications conversationIDKey={conversationIDKey} />)
}

// The desktop group renders before the mobile group, so each label appears twice.
const clickDesktop = (label: string) => fireEvent.click(screen.getAllByText(label)[0]!)
const clickMobile = (label: string) => fireEvent.click(screen.getAllByText(label)[1]!)

const saveIndicator = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('div[style*="height: 17px"]')!

const selectedLabels = (container: HTMLElement) =>
  [...container.querySelectorAll('.radio-button.selected')].map(
    r => r.parentElement?.querySelector('.text_Body')?.textContent
  )

let fake: FakeEngine

beforeEach(() => {
  fake = installFakeEngine()
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

describe('saveNotifications', () => {
  test('choosing a desktop setting sends the choice with the current mobile setting', async () => {
    fake.answer(setSettings, () => null)
    renderNotifications()

    clickDesktop('Only when @mentioned')
    await flush()

    // exactly one call, with no waiting key
    expect(paramsOf(fake, setSettings)).toEqual([
      {
        channelWide: false,
        convID,
        settings: [
          {deviceType: T.RPCGen.DeviceType.desktop, enabled: true, kind: T.RPCChat.NotificationKind.atmention},
          {deviceType: T.RPCGen.DeviceType.desktop, enabled: false, kind: T.RPCChat.NotificationKind.generic},
          {deviceType: T.RPCGen.DeviceType.mobile, enabled: false, kind: T.RPCChat.NotificationKind.atmention},
          {deviceType: T.RPCGen.DeviceType.mobile, enabled: false, kind: T.RPCChat.NotificationKind.generic},
        ],
      },
    ])
  })

  test('choosing a mobile setting sends the choice with the current desktop setting', async () => {
    fake.answer(setSettings, () => null)
    renderNotifications()

    clickMobile('On any activity')
    await flush()

    expect(sent()).toEqual([{channelWide: false, convID, ...choice('onAnyActivity', 'onAnyActivity')}])
  })

  test('successive choices each resend the combined desktop and mobile state', async () => {
    fake.answer(setSettings, () => null)
    renderNotifications({notificationsDesktop: 'onWhenAtMentioned', notificationsMobile: 'onAnyActivity'})

    clickDesktop('Never')
    await flush()
    clickMobile('Only when @mentioned')
    await flush()

    expect(sent().map(p => choice(p.desktop, p.mobile))).toEqual([
      choice('never', 'onAnyActivity'),
      choice('never', 'onWhenAtMentioned'),
    ])
  })

  test('the ignore @here/@channel checkbox flips channelWide and resends the current settings', async () => {
    fake.answer(setSettings, () => null)
    renderNotifications()

    fireEvent.click(screen.getByText(/mentions/))
    await flush()

    expect(sent()).toEqual([{channelWide: true, convID, ...choice('onAnyActivity', 'never')}])
  })

  test('a successful save shows the spinner while waiting and then Saved, with no error', async () => {
    const held = fake.hold(setSettings)
    const {container} = renderNotifications()

    clickDesktop('Only when @mentioned')
    await flush()

    expect(saveIndicator(container).childElementCount).toBeGreaterThan(0)
    expect(saveIndicator(container).textContent).not.toContain('Saved')

    held[0]!.reply(null)
    await flush()

    expect(saveIndicator(container).textContent).toContain('Saved')
    expect(selectedLabels(container)).toEqual(['Only when @mentioned', 'Never'])
    expect(container.textContent).not.toContain('Failed')
  })

  // the engine's RPCError is not an Error, so the banner shows the generic text (see the failing
  // test below)
  test('a failed save shows the error in a red banner and keeps the new choice selected', async () => {
    fake.answer(setSettings, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'service said no'))
    const {container} = renderNotifications()

    clickDesktop('Only when @mentioned')
    await flush()

    expect(screen.getByText('service said no')).toBeTruthy()
    // no revert: the radio stays on what was picked even though the service rejected it
    expect(selectedLabels(container)).toEqual(['Only when @mentioned', 'Never'])
    // saving flips back to false, which the indicator renders as Saved next to the error
    expect(saveIndicator(container).textContent).toContain('Saved')
  })

  test("a service failure shows the service's reason in the banner", async () => {
    fake.answer(setSettings, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'service said no'))
    renderNotifications()

    clickDesktop('Never')
    await flush()

    expect(screen.getByText(/service said no/)).toBeTruthy()
  })

  test('a failure without a description falls back to generic error text', async () => {
    fake.answer(setSettings, () => fakeError(T.RPCGen.StatusCode.scgeneric, ''))
    renderNotifications()

    clickDesktop('Never')
    await flush()

    expect(screen.getByText('Failed to save notification settings.')).toBeTruthy()
  })

  test('the next save clears a previous error banner', async () => {
    const held = fake.hold(setSettings)
    renderNotifications()

    clickDesktop('Never')
    await flush()
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'service said no'))
    await flush()
    expect(screen.queryByText('service said no')).toBeTruthy()

    clickMobile('On any activity')
    await flush()
    held[1]!.reply(null)
    await flush()

    expect(paramsOf(fake, setSettings)).toHaveLength(2)
    expect(screen.queryByText('service said no')).toBeNull()
  })

  test('a failure of an older save is ignored once a newer save has started', async () => {
    const held = fake.hold(setSettings)
    renderNotifications()

    clickDesktop('Never')
    await flush()
    clickMobile('On any activity')
    await flush()

    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'stale failure'))
    await flush()

    expect(screen.queryByText('stale failure')).toBeNull()

    held[1]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'current failure'))
    await flush()

    expect(screen.getByText('current failure')).toBeTruthy()
  })
})
