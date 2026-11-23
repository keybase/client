/** @jest-environment jsdom */
/// <reference types="jest" />
import {afterEach, expect, jest, test} from '@jest/globals'
import {act, cleanup, renderHook} from '@testing-library/react'
import * as T from '@/constants/types'
import logger from '@/logger'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {
  type UseNotificationSettingsResult,
  buildNotificationGroups,
  buildNotificationSavePayload,
  toggleNotificationGroup,
  default as useNotificationSettings,
} from './use-notification-settings'

const loadRpc = 'chat.1.local.getNotificationSettingsLocal'
const saveRpc = 'chat.1.local.setNotificationSettingsLocal'

const holdAll = (fake: FakeEngine) => ({
  load: fake.hold(loadRpc),
  save: fake.hold(saveRpc),
})

const reply = async (held: Array<{reply: (a: unknown) => void}>, a: unknown) => {
  held.shift()!.reply(a)
  await flush()
}

const makeLoaded = (chatGlobal: {[key: string]: boolean} = {}): T.RPCChat.NotificationSettingsLocal => ({
  chatGlobal: {settings: chatGlobal} as T.RPCChat.GlobalAppNotificationSettings,
  subscriptions: [
    {
      name: 'email',
      settings: [{description: 'Email', name: 'newmessages', subscribed: true}],
      unsub: false,
    },
  ],
})

const snapshotGroups = (groups: UseNotificationSettingsResult['groups']) =>
  Object.fromEntries(
    [...groups.entries()].map(([group, value]) => [
      group,
      {
        settings: value.settings.map(({description, name, subscribed}) => ({description, name, subscribed})),
        unsub: value.unsub,
      },
    ])
  )

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
})

test('buildNotificationGroups merges the subscriptions and the chat-global settings', () => {
  const groups = buildNotificationGroups(
    makeLoaded({
      [`${T.RPCChat.GlobalAppNotificationSetting.plaintextmobile}`]: true,
      [`${T.RPCChat.GlobalAppNotificationSetting.plaintextdesktop}`]: false,
      [`${T.RPCChat.GlobalAppNotificationSetting.disabletyping}`]: false,
      [`${T.RPCChat.GlobalAppNotificationSetting.convertheic}`]: true,
    })
  )

  expect(groups.get('email')?.settings[0]?.name).toBe('newmessages')
  expect(groups.get('security')?.settings.map(setting => setting.name)).toEqual([
    'plaintextmobile',
    'plaintextdesktop',
    'disabletyping',
  ])
  expect(groups.get('security')?.settings[0]?.subscribed).toBe(true)
  expect(groups.get('security')?.settings[1]?.subscribed).toBe(false)
  expect(groups.get('security')?.settings[2]?.subscribed).toBe(true)
  expect(groups.get('misc')?.settings[0]?.subscribed).toBe(true)
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
  ])

  const nextGroups = toggleNotificationGroup(groups, 'security', 'plaintextmobile')
  expect(nextGroups.get('security')?.settings[0]?.subscribed).toBe(false)

  expect(buildNotificationSavePayload(nextGroups)).toEqual({
    chatGlobal: {
      [`${T.RPCChat.GlobalAppNotificationSetting.disabletyping}`]: true,
      [`${T.RPCChat.GlobalAppNotificationSetting.plaintextmobile}`]: false,
    },
    subscriptions: [
      {name: 'email', settings: [{description: 'Email', name: 'newmessages', subscribed: true}], unsub: false},
    ],
  })
})

test('useNotificationSettings loads and saves notification settings in one call each', async () => {
  const fake = installFakeEngine()
  const held = holdAll(fake)
  const {result} = renderHook(() => useNotificationSettings())

  act(() => {
    result.current.refresh()
  })
  await flush()

  expect(result.current.allowEdit).toBe(false)
  expect(held.load).toHaveLength(1)

  await reply(
    held.load,
    makeLoaded({
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
  expect(held.save[0]!.params).toEqual(
    expect.objectContaining({
      chatGlobal: {
        [`${T.RPCChat.GlobalAppNotificationSetting.convertheic}`]: false,
        [`${T.RPCChat.GlobalAppNotificationSetting.defaultsoundmobile}`]: false,
        [`${T.RPCChat.GlobalAppNotificationSetting.disabletyping}`]: false,
        [`${T.RPCChat.GlobalAppNotificationSetting.plaintextdesktop}`]: false,
        [`${T.RPCChat.GlobalAppNotificationSetting.plaintextmobile}`]: false,
      },
      subscriptions: [
        {name: 'email', settings: [{description: 'Email', name: 'newmessages', subscribed: true}], unsub: false},
      ],
    })
  )

  await reply(held.save, null)

  expect(result.current.allowEdit).toBe(true)
  expect(snapshotGroups(result.current.groups)['security']?.settings[0]?.subscribed).toBe(false)
  expect(fake.calls.map(c => c.method)).toEqual([loadRpc, saveRpc])
})

test('useNotificationSettings restores the optimistic state when the save fails', async () => {
  const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {})
  const fake = installFakeEngine()
  const held = holdAll(fake)
  const {result} = renderHook(() => useNotificationSettings())

  act(() => {
    result.current.refresh()
  })
  await flush()
  await reply(held.load, makeLoaded({[`${T.RPCChat.GlobalAppNotificationSetting.plaintextmobile}`]: true}))
  expect(result.current.allowEdit).toBe(true)

  const previousGroups = snapshotGroups(result.current.groups)

  act(() => {
    result.current.toggle('security', 'plaintextmobile')
  })
  await flush()
  expect(snapshotGroups(result.current.groups)['security']?.settings[0]?.subscribed).toBe(false)

  await reply(held.save, fakeError(T.RPCGen.StatusCode.scgeneric, 'subscribe failed'))

  expect(result.current.allowEdit).toBe(true)
  expect(snapshotGroups(result.current.groups)).toEqual(previousGroups)
  expect(warnSpy).toHaveBeenCalledWith('Failed to save notification settings', expect.anything())
})
