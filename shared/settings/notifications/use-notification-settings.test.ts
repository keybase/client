/// <reference types="jest" />
import * as T from '@/constants/types'
import {
  buildNotificationGroups,
  buildNotificationSavePayload,
  toggleNotificationGroup,
} from './use-notification-settings'

const makeChatGlobalSettings = (settings: {[key: string]: boolean} = {}) =>
  ({settings} as T.RPCChat.GlobalAppNotificationSettings)

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
