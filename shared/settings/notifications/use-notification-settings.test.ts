/** @jest-environment jsdom */
/// <reference types="jest" />
import {afterEach, expect, jest, test} from '@jest/globals'
import {act, cleanup, renderHook} from '@testing-library/react'
import * as T from '@/constants/types'
import logger from '@/logger'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {
  type UseNotificationSettingsResult,
  buildNotificationGroups,
  buildNotificationSavePayload,
  toggleNotificationGroup,
  default as useNotificationSettings,
} from './use-notification-settings'

const makeChatGlobalSettings = (settings: {[key: string]: boolean} = {}) =>
  ({settings} as T.RPCChat.GlobalAppNotificationSettings)

const loadSubscriptionsRpc = 'keybase.1.apiserver.GetWithSession'
const loadGlobalSettingsRpc = 'chat.1.local.getGlobalAppNotificationSettingsLocal'
const saveSubscriptionsRpc = 'keybase.1.apiserver.PostJSON'
const saveGlobalSettingsRpc = 'chat.1.local.setGlobalAppNotificationSettingsLocal'

// Every call of the four held, so a test answers each in turn
const holdAll = (fake: FakeEngine) => ({
  loadGlobalSettings: fake.hold(loadGlobalSettingsRpc),
  loadSubscriptions: fake.hold(loadSubscriptionsRpc),
  saveGlobalSettings: fake.hold(saveGlobalSettingsRpc),
  saveSubscriptions: fake.hold(saveSubscriptionsRpc),
})

const reply = async (held: Array<{reply: (a: unknown) => void}>, a: unknown) => {
  held.shift()!.reply(a)
  await flush()
}

const makeSubscriptionsResponse = () =>
  ({
    body: JSON.stringify({
      notifications: {
        email: {
          settings: [{description: 'Email', description_h: 'Email', name: 'newmessages', subscribed: true}],
          unsub: false,
        },
      },
    }),
  }) as T.RPCGen.APIRes

const snapshotGroups = (groups: UseNotificationSettingsResult['groups']) =>
  [...groups.entries()].reduce(
    (acc, [group, value]) => ({
      ...acc,
      [group]: {
        settings: value.settings.map(setting => ({
          description: setting.description,
          name: setting.name,
          subscribed: setting.subscribed,
        })),
        unsub: value.unsub,
      },
    }),
    {} as Record<
      string,
      {
        settings: Array<{description: string; name: string; subscribed: boolean}>
        unsub: boolean
      }
    >
  )

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
})

test('buildNotificationGroups merges API and chat-global notification settings', () => {
  const groups = buildNotificationGroups(
    JSON.stringify({
      notifications: {
        email: {
          settings: [{description: 'Email', description_h: 'Email', name: 'newmessages', subscribed: true}],
          unsub: false,
        },
      },
    }),
    makeChatGlobalSettings({
      [`${T.RPCChat.GlobalAppNotificationSetting.plaintextmobile}`]: true,
      [`${T.RPCChat.GlobalAppNotificationSetting.plaintextdesktop}`]: false,
      [`${T.RPCChat.GlobalAppNotificationSetting.disabletyping}`]: false,
      [`${T.RPCChat.GlobalAppNotificationSetting.convertheic}`]: true,
    })
  )

  expect(groups?.get('email')?.settings[0]?.name).toBe('newmessages')
  expect(groups?.get('security')?.settings.map(setting => setting.name)).toEqual([
    'plaintextmobile',
    'plaintextdesktop',
    'disabletyping',
  ])
  expect(groups?.get('security')?.settings[0]?.subscribed).toBe(true)
  expect(groups?.get('security')?.settings[1]?.subscribed).toBe(false)
  expect(groups?.get('security')?.settings[2]?.subscribed).toBe(true)
  expect(groups?.get('misc')?.settings[0]?.subscribed).toBe(true)
})

test('toggleNotificationGroup and buildNotificationSavePayload preserve optimistic toggle semantics', () => {
  const groups = new Map([
    [
      'email',
      {
        settings: [{description: 'Email', name: 'newmessages', subscribed: true}],
        unsub: false,
      },
    ],
    [
      'security',
      {
        settings: [
          {description: 'Phone', name: 'plaintextmobile', subscribed: true},
          {description: 'Typing', name: 'disabletyping', subscribed: false},
        ],
        unsub: false,
      },
    ],
  ]) as Parameters<typeof toggleNotificationGroup>[0]

  const nextGroups = toggleNotificationGroup(groups, 'security', 'plaintextmobile')
  expect(nextGroups.get('security')?.settings[0]?.subscribed).toBe(false)

  const payload = buildNotificationSavePayload(nextGroups)
  expect(payload.JSONPayload).toEqual([
    {key: 'newmessages|email', value: '1'},
    {key: 'unsub|email', value: '0'},
  ])
  expect(payload.chatGlobalArg).toEqual({
    [`${T.RPCChat.GlobalAppNotificationSetting.disabletyping}`]: true,
    [`${T.RPCChat.GlobalAppNotificationSetting.plaintextmobile}`]: false,
  })
})

test('useNotificationSettings refreshes and saves notification settings through the service', async () => {
  const fake = installFakeEngine()
  const held = holdAll(fake)
  const {result} = renderHook(() => useNotificationSettings())

  act(() => {
    result.current.refresh()
  })
  await flush()

  expect(result.current.allowEdit).toBe(false)
  expect(held.loadSubscriptions[0]!.params).toEqual(
    expect.objectContaining({args: [], endpoint: 'account/subscriptions'})
  )
  // the chat settings are asked for only once the subscriptions are in
  expect(held.loadGlobalSettings).toHaveLength(0)

  await reply(held.loadSubscriptions, makeSubscriptionsResponse())
  expect(held.loadGlobalSettings).toHaveLength(1)

  await reply(
    held.loadGlobalSettings,
    makeChatGlobalSettings({
      [`${T.RPCChat.GlobalAppNotificationSetting.disabletyping}`]: false,
      [`${T.RPCChat.GlobalAppNotificationSetting.plaintextdesktop}`]: false,
      [`${T.RPCChat.GlobalAppNotificationSetting.plaintextmobile}`]: true,
    })
  )

  expect(result.current.allowEdit).toBe(true)
  expect(snapshotGroups(result.current.groups)).toMatchObject({
    email: {
      settings: [{description: 'Email', name: 'newmessages', subscribed: true}],
      unsub: false,
    },
    security: {
      settings: [
        {description: 'Show message content in phone chat notifications', name: 'plaintextmobile', subscribed: true},
        {
          description: 'Show message content in computer chat notifications',
          name: 'plaintextdesktop',
          subscribed: false,
        },
        {description: "Show others when you're typing", name: 'disabletyping', subscribed: true},
      ],
      unsub: false,
    },
  })

  act(() => {
    result.current.toggle('security', 'plaintextmobile')
  })
  await flush()

  expect(result.current.allowEdit).toBe(false)
  expect(snapshotGroups(result.current.groups)['security']?.settings[0]?.subscribed).toBe(false)
  expect(held.saveSubscriptions[0]!.params).toEqual(
    expect.objectContaining({
      JSONPayload: [
        {key: 'newmessages|email', value: '1'},
        {key: 'unsub|email', value: '0'},
      ],
      args: [],
      endpoint: 'account/subscribe',
    })
  )

  await reply(held.saveSubscriptions, {body: JSON.stringify({status: {code: 0}})})

  expect(held.saveGlobalSettings[0]!.params).toEqual(
    expect.objectContaining({
      settings: expect.objectContaining({
        [`${T.RPCChat.GlobalAppNotificationSetting.convertheic}`]: false,
        [`${T.RPCChat.GlobalAppNotificationSetting.defaultsoundmobile}`]: false,
        [`${T.RPCChat.GlobalAppNotificationSetting.disabletyping}`]: false,
        [`${T.RPCChat.GlobalAppNotificationSetting.plaintextdesktop}`]: false,
        [`${T.RPCChat.GlobalAppNotificationSetting.plaintextmobile}`]: false,
      }),
    })
  )
  expect(result.current.allowEdit).toBe(false)

  await reply(held.saveGlobalSettings, null)

  expect(result.current.allowEdit).toBe(true)
  expect(snapshotGroups(result.current.groups)['security']?.settings[0]?.subscribed).toBe(false)
})

test('useNotificationSettings restores optimistic state when save fails', async () => {
  const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {})
  const fake = installFakeEngine()
  const held = holdAll(fake)
  const {result} = renderHook(() => useNotificationSettings())

  act(() => {
    result.current.refresh()
  })
  await flush()
  await reply(held.loadSubscriptions, makeSubscriptionsResponse())
  await reply(
    held.loadGlobalSettings,
    makeChatGlobalSettings({
      [`${T.RPCChat.GlobalAppNotificationSetting.disabletyping}`]: false,
      [`${T.RPCChat.GlobalAppNotificationSetting.plaintextmobile}`]: true,
    })
  )
  expect(result.current.allowEdit).toBe(true)

  const previousGroups = snapshotGroups(result.current.groups)

  act(() => {
    result.current.toggle('security', 'plaintextmobile')
  })
  await flush()

  expect(result.current.allowEdit).toBe(false)
  expect(snapshotGroups(result.current.groups)['security']?.settings[0]?.subscribed).toBe(false)

  await reply(held.saveSubscriptions, {body: JSON.stringify({status: {code: 1}})})
  await reply(held.saveGlobalSettings, null)

  expect(result.current.allowEdit).toBe(true)
  expect(snapshotGroups(result.current.groups)).toEqual(previousGroups)
  expect(warnSpy).toHaveBeenCalledWith('Failed to save notification settings', expect.any(Error))
})
