/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {makeConversationMeta} from '@/constants/chat/meta'
import {flush} from '@/test/flush'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convID = T.Chat.keyToConversationID(conversationIDKey)

let mockMeta: T.Chat.ConversationMeta = makeConversationMeta()
jest.mock('../../data-hooks', () => ({
  useConversationMeta: () => mockMeta,
}))

import Notifications from './notifications'

const ok = {offline: false}
const {desktop, mobile} = T.RPCGen.DeviceType
const {atmention, generic} = T.RPCChat.NotificationKind

// The four entries the service receives for one desktop/mobile choice, in the order sent.
const settingsFor = (d: T.Chat.NotificationsType, m: T.Chat.NotificationsType) => [
  {deviceType: desktop, enabled: d === 'onWhenAtMentioned', kind: atmention},
  {deviceType: desktop, enabled: d === 'onAnyActivity', kind: generic},
  {deviceType: mobile, enabled: m === 'onWhenAtMentioned', kind: atmention},
  {deviceType: mobile, enabled: m === 'onAnyActivity', kind: generic},
]

const renderNotifications = (over: Partial<T.Chat.ConversationMeta> = {}) => {
  mockMeta = {
    ...makeConversationMeta(),
    conversationIDKey,
    notificationsDesktop: 'onAnyActivity',
    notificationsGlobalIgnoreMentions: false,
    notificationsMobile: 'never',
    ...over,
  }
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

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  mockMeta = makeConversationMeta()
})

describe('saveNotifications', () => {
  test('choosing a desktop setting sends all four entries with the current mobile setting', async () => {
    const spy = jest.spyOn(T.RPCChat, 'localSetAppNotificationSettingsLocalRpcPromise').mockResolvedValue(ok)
    renderNotifications()

    clickDesktop('Only when @mentioned')
    await flush()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith({
      channelWide: false,
      convID,
      settings: settingsFor('onWhenAtMentioned', 'never'),
    })
    // no waiting key
    expect(spy.mock.calls[0]).toHaveLength(1)
  })

  test('choosing a mobile setting sends all four entries with the current desktop setting', async () => {
    const spy = jest.spyOn(T.RPCChat, 'localSetAppNotificationSettingsLocalRpcPromise').mockResolvedValue(ok)
    renderNotifications()

    clickMobile('On any activity')
    await flush()

    expect(spy).toHaveBeenCalledWith({
      channelWide: false,
      convID,
      settings: settingsFor('onAnyActivity', 'onAnyActivity'),
    })
  })

  test('successive choices each resend the combined desktop and mobile state', async () => {
    const spy = jest.spyOn(T.RPCChat, 'localSetAppNotificationSettingsLocalRpcPromise').mockResolvedValue(ok)
    renderNotifications({notificationsDesktop: 'onWhenAtMentioned', notificationsMobile: 'onAnyActivity'})

    clickDesktop('Never')
    await flush()
    clickMobile('Only when @mentioned')
    await flush()

    expect(spy.mock.calls.map(c => c[0].settings)).toEqual([
      settingsFor('never', 'onAnyActivity'),
      settingsFor('never', 'onWhenAtMentioned'),
    ])
  })

  test('the ignore @here/@channel checkbox flips channelWide and resends the current settings', async () => {
    const spy = jest.spyOn(T.RPCChat, 'localSetAppNotificationSettingsLocalRpcPromise').mockResolvedValue(ok)
    renderNotifications()

    fireEvent.click(screen.getByText(/mentions/))
    await flush()

    expect(spy).toHaveBeenCalledWith({
      channelWide: true,
      convID,
      settings: settingsFor('onAnyActivity', 'never'),
    })
  })

  test('a successful save shows the spinner while waiting and then Saved, with no error', async () => {
    let resolveSave: (() => void) | undefined
    jest.spyOn(T.RPCChat, 'localSetAppNotificationSettingsLocalRpcPromise').mockImplementation(
      async () =>
        new Promise<T.RPCChat.SetAppNotificationSettingsLocalRes>(resolve => {
          resolveSave = () => resolve(ok)
        })
    )
    const {container} = renderNotifications()

    clickDesktop('Only when @mentioned')
    await flush()

    expect(saveIndicator(container).childElementCount).toBeGreaterThan(0)
    expect(saveIndicator(container).textContent).not.toContain('Saved')

    resolveSave?.()
    await flush()

    expect(saveIndicator(container).textContent).toContain('Saved')
    expect(selectedLabels(container)).toEqual(['Only when @mentioned', 'Never'])
    expect(container.textContent).not.toContain('Failed')
  })

  test('a failed save shows the error message in a red banner and keeps the new choice selected', async () => {
    jest
      .spyOn(T.RPCChat, 'localSetAppNotificationSettingsLocalRpcPromise')
      .mockRejectedValue(new Error('service said no'))
    const {container} = renderNotifications()

    clickDesktop('Only when @mentioned')
    await flush()

    expect(screen.getByText('service said no')).toBeTruthy()
    // no revert: the radio stays on what was picked even though the service rejected it
    expect(selectedLabels(container)).toEqual(['Only when @mentioned', 'Never'])
    // saving flips back to false, which the indicator renders as Saved next to the error
    expect(saveIndicator(container).textContent).toContain('Saved')
  })

  test('a failure without a message falls back to generic error text', async () => {
    jest.spyOn(T.RPCChat, 'localSetAppNotificationSettingsLocalRpcPromise').mockRejectedValue(new Error(''))
    renderNotifications()

    clickDesktop('Never')
    await flush()

    expect(screen.getByText('Failed to save notification settings.')).toBeTruthy()
  })

  test('the next save clears a previous error banner', async () => {
    const spy = jest
      .spyOn(T.RPCChat, 'localSetAppNotificationSettingsLocalRpcPromise')
      .mockRejectedValueOnce(new Error('service said no'))
      .mockResolvedValueOnce(ok)
    renderNotifications()

    clickDesktop('Never')
    await flush()
    expect(screen.queryByText('service said no')).toBeTruthy()

    clickMobile('On any activity')
    await flush()

    expect(spy).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('service said no')).toBeNull()
  })

  test('a failure of an older save is ignored once a newer save has started', async () => {
    const rejects: Array<(e: Error) => void> = []
    jest.spyOn(T.RPCChat, 'localSetAppNotificationSettingsLocalRpcPromise').mockImplementation(
      async () =>
        new Promise<T.RPCChat.SetAppNotificationSettingsLocalRes>((_resolve, reject) => {
          rejects.push(reject)
        })
    )
    renderNotifications()

    clickDesktop('Never')
    await flush()
    clickMobile('On any activity')
    await flush()

    rejects[0]?.(new Error('stale failure'))
    await flush()

    expect(screen.queryByText('stale failure')).toBeNull()

    rejects[1]?.(new Error('current failure'))
    await flush()

    expect(screen.getByText('current failure')).toBeTruthy()
  })
})
