/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {makeConversationMeta} from '@/constants/chat/meta'
import {flush} from '@/test/flush'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

let mockMeta: T.Chat.ConversationMeta = makeConversationMeta()
jest.mock('../../data-hooks', () => ({
  useConversationMeta: () => mockMeta,
}))

import Notifications from './notifications'

// The combined desktop/mobile choice the service is sent.
const choice = (desktop: T.Chat.NotificationsType, mobile: T.Chat.NotificationsType) => ({desktop, mobile})

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

let rpc: FakeChatRpc

beforeEach(() => {
  rpc = installFakeChatRpc()
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  restoreChatRpc()
  mockMeta = makeConversationMeta()
})

describe('saveNotifications', () => {
  test('choosing a desktop setting sends the choice with the current mobile setting', async () => {
    renderNotifications()

    clickDesktop('Only when @mentioned')
    await flush()

    // exactly one call, with no waiting key
    expect(rpc.calls('setNotificationSettings')).toEqual([
      [{channelWide: false, conversationIDKey, ...choice('onWhenAtMentioned', 'never')}],
    ])
  })

  test('choosing a mobile setting sends the choice with the current desktop setting', async () => {
    renderNotifications()

    clickMobile('On any activity')
    await flush()

    expect(rpc.params('setNotificationSettings')).toEqual([
      {channelWide: false, conversationIDKey, ...choice('onAnyActivity', 'onAnyActivity')},
    ])
  })

  test('successive choices each resend the combined desktop and mobile state', async () => {
    renderNotifications({notificationsDesktop: 'onWhenAtMentioned', notificationsMobile: 'onAnyActivity'})

    clickDesktop('Never')
    await flush()
    clickMobile('Only when @mentioned')
    await flush()

    expect(rpc.params('setNotificationSettings').map(p => choice(p.desktop, p.mobile))).toEqual([
      choice('never', 'onAnyActivity'),
      choice('never', 'onWhenAtMentioned'),
    ])
  })

  test('the ignore @here/@channel checkbox flips channelWide and resends the current settings', async () => {
    renderNotifications()

    fireEvent.click(screen.getByText(/mentions/))
    await flush()

    expect(rpc.params('setNotificationSettings')).toEqual([
      {channelWide: true, conversationIDKey, ...choice('onAnyActivity', 'never')},
    ])
  })

  test('a successful save shows the spinner while waiting and then Saved, with no error', async () => {
    let resolveSave: (() => void) | undefined
    rpc.on(
      'setNotificationSettings',
      async () =>
        new Promise<void>(resolve => {
          resolveSave = resolve
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
    rpc.fail('setNotificationSettings', new Error('service said no'))
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
    rpc.fail('setNotificationSettings', new Error(''))
    renderNotifications()

    clickDesktop('Never')
    await flush()

    expect(screen.getByText('Failed to save notification settings.')).toBeTruthy()
  })

  test('the next save clears a previous error banner', async () => {
    rpc.failOnce('setNotificationSettings', new Error('service said no'))
    rpc.once('setNotificationSettings', () => undefined)
    renderNotifications()

    clickDesktop('Never')
    await flush()
    expect(screen.queryByText('service said no')).toBeTruthy()

    clickMobile('On any activity')
    await flush()

    expect(rpc.calls('setNotificationSettings')).toHaveLength(2)
    expect(screen.queryByText('service said no')).toBeNull()
  })

  test('a failure of an older save is ignored once a newer save has started', async () => {
    const rejects: Array<(e: Error) => void> = []
    rpc.on(
      'setNotificationSettings',
      async () =>
        new Promise<void>((_resolve, reject) => {
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
