/** @jest-environment jsdom */
/// <reference types="jest" />
import {afterEach, expect, jest, test} from '@jest/globals'
import {act, cleanup, renderHook, waitFor} from '@testing-library/react'
import * as C from '@/constants'
import * as S from '@/constants/strings'
import * as T from '@/constants/types'
import logger from '@/logger'
import {
  type UseNotificationSettingsResult,
  buildNotificationGroups,
  buildNotificationSavePayload,
  toggleNotificationGroup,
  default as useNotificationSettings,
} from './use-notification-settings'

const makeChatGlobalSettings = (settings: {[key: string]: boolean} = {}) =>
  ({settings} as T.RPCChat.GlobalAppNotificationSettings)

type SubmitHandler<TArgs, TResult> = (
  args: TArgs,
  resolve: (result: TResult) => void,
  reject: (error: Error) => void
) => void

const createRPCMock = <TArgs, TResult>() => {
  const pending = new Array<{resolve: (result: TResult) => void; reject: (error: Error) => void}>()
  const submit = jest.fn<SubmitHandler<TArgs, TResult>>((_, resolve, reject) => {
    pending.push({reject, resolve})
  })
  return {
    rejectNext: (error: Error) => pending.shift()?.reject(error),
    resolveNext: (result: TResult) => pending.shift()?.resolve(result),
    submit,
  }
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

test('useNotificationSettings refreshes and saves notification settings through RPC hooks', async () => {
  const loadSubscriptionsRPC = createRPCMock<
    [{args: Array<string>; endpoint: string}, string],
    T.RPCGen.APIRes
  >()
  const loadGlobalSettingsRPC = createRPCMock<
    [undefined, string],
    T.RPCChat.GlobalAppNotificationSettings
  >()
  const saveSubscriptionsRPC = createRPCMock<
    [{JSONPayload: Array<{key: string; value: string}>; args: Array<string>; endpoint: string}, string],
    T.RPCGen.APIRes
  >()
  const saveGlobalSettingsRPC = createRPCMock<
    [{settings: {[key: string]: boolean}}, string],
    undefined
  >()
  const rpcSubmitters = new Map<unknown, unknown>([
    [T.RPCGen.apiserverGetWithSessionRpcPromise, loadSubscriptionsRPC.submit],
    [T.RPCChat.localGetGlobalAppNotificationSettingsLocalRpcPromise, loadGlobalSettingsRPC.submit],
    [T.RPCGen.apiserverPostJSONRpcPromise, saveSubscriptionsRPC.submit],
    [T.RPCChat.localSetGlobalAppNotificationSettingsLocalRpcPromise, saveGlobalSettingsRPC.submit],
  ])
  jest.spyOn(C, 'useRPC').mockImplementation(((rpc: unknown) => {
    const submit = rpcSubmitters.get(rpc)
    if (!submit) {
      throw new Error('Unexpected RPC hook')
    }
    return submit
  }) as never)

  const {result} = renderHook(() => useNotificationSettings())

  act(() => {
    result.current.refresh()
  })

  expect(result.current.allowEdit).toBe(false)
  expect(loadSubscriptionsRPC.submit).toHaveBeenCalledWith(
    [{args: [], endpoint: 'account/subscriptions'}, S.refreshNotificationsWaitingKey],
    expect.any(Function),
    expect.any(Function)
  )

  act(() => {
    loadSubscriptionsRPC.resolveNext(makeSubscriptionsResponse())
  })

  await waitFor(() =>
    expect(loadGlobalSettingsRPC.submit).toHaveBeenCalledWith(
      [undefined, S.refreshNotificationsWaitingKey],
      expect.any(Function),
      expect.any(Function)
    )
  )

  act(() => {
    loadGlobalSettingsRPC.resolveNext(
      makeChatGlobalSettings({
        [`${T.RPCChat.GlobalAppNotificationSetting.disabletyping}`]: false,
        [`${T.RPCChat.GlobalAppNotificationSetting.plaintextdesktop}`]: false,
        [`${T.RPCChat.GlobalAppNotificationSetting.plaintextmobile}`]: true,
      })
    )
  })

  await waitFor(() => expect(result.current.allowEdit).toBe(true))
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

  expect(result.current.allowEdit).toBe(false)
  expect(snapshotGroups(result.current.groups)['security']?.settings[0]?.subscribed).toBe(false)
  expect(saveSubscriptionsRPC.submit).toHaveBeenCalledWith(
    [
      {
        JSONPayload: [
          {key: 'newmessages|email', value: '1'},
          {key: 'unsub|email', value: '0'},
        ],
        args: [],
        endpoint: 'account/subscribe',
      },
      S.waitingKeySettingsGeneric,
    ],
    expect.any(Function),
    expect.any(Function)
  )

  act(() => {
    saveSubscriptionsRPC.resolveNext({body: JSON.stringify({status: {code: 0}})} as T.RPCGen.APIRes)
  })

  await waitFor(() =>
    expect(saveGlobalSettingsRPC.submit).toHaveBeenCalledWith(
      [
        {
          settings: expect.objectContaining({
            [`${T.RPCChat.GlobalAppNotificationSetting.convertheic}`]: false,
            [`${T.RPCChat.GlobalAppNotificationSetting.defaultsoundmobile}`]: false,
            [`${T.RPCChat.GlobalAppNotificationSetting.disabletyping}`]: true,
            [`${T.RPCChat.GlobalAppNotificationSetting.plaintextdesktop}`]: false,
            [`${T.RPCChat.GlobalAppNotificationSetting.plaintextmobile}`]: false,
          }),
        },
        S.waitingKeySettingsGeneric,
      ],
      expect.any(Function),
      expect.any(Function)
    )
  )

  act(() => {
    saveGlobalSettingsRPC.resolveNext(undefined)
  })

  await waitFor(() => expect(result.current.allowEdit).toBe(true))
  expect(snapshotGroups(result.current.groups)['security']?.settings[0]?.subscribed).toBe(false)
})

test('useNotificationSettings restores optimistic state when save fails', async () => {
  const loadSubscriptionsRPC = createRPCMock<
    [{args: Array<string>; endpoint: string}, string],
    T.RPCGen.APIRes
  >()
  const loadGlobalSettingsRPC = createRPCMock<
    [undefined, string],
    T.RPCChat.GlobalAppNotificationSettings
  >()
  const saveSubscriptionsRPC = createRPCMock<
    [{JSONPayload: Array<{key: string; value: string}>; args: Array<string>; endpoint: string}, string],
    T.RPCGen.APIRes
  >()
  const saveGlobalSettingsRPC = createRPCMock<
    [{settings: {[key: string]: boolean}}, string],
    undefined
  >()
  const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {})
  const rpcSubmitters = new Map<unknown, unknown>([
    [T.RPCGen.apiserverGetWithSessionRpcPromise, loadSubscriptionsRPC.submit],
    [T.RPCChat.localGetGlobalAppNotificationSettingsLocalRpcPromise, loadGlobalSettingsRPC.submit],
    [T.RPCGen.apiserverPostJSONRpcPromise, saveSubscriptionsRPC.submit],
    [T.RPCChat.localSetGlobalAppNotificationSettingsLocalRpcPromise, saveGlobalSettingsRPC.submit],
  ])
  jest.spyOn(C, 'useRPC').mockImplementation(((rpc: unknown) => {
    const submit = rpcSubmitters.get(rpc)
    if (!submit) {
      throw new Error('Unexpected RPC hook')
    }
    return submit
  }) as never)

  const {result} = renderHook(() => useNotificationSettings())

  act(() => {
    result.current.refresh()
  })
  act(() => {
    loadSubscriptionsRPC.resolveNext(makeSubscriptionsResponse())
  })
  await waitFor(() => expect(loadGlobalSettingsRPC.submit).toHaveBeenCalled())
  act(() => {
    loadGlobalSettingsRPC.resolveNext(
      makeChatGlobalSettings({
        [`${T.RPCChat.GlobalAppNotificationSetting.disabletyping}`]: false,
        [`${T.RPCChat.GlobalAppNotificationSetting.plaintextmobile}`]: true,
      })
    )
  })
  await waitFor(() => expect(result.current.allowEdit).toBe(true))

  const previousGroups = snapshotGroups(result.current.groups)

  act(() => {
    result.current.toggle('security', 'plaintextmobile')
  })

  expect(result.current.allowEdit).toBe(false)
  expect(snapshotGroups(result.current.groups)['security']?.settings[0]?.subscribed).toBe(false)

  act(() => {
    saveSubscriptionsRPC.resolveNext({body: JSON.stringify({status: {code: 1}})} as T.RPCGen.APIRes)
  })
  await waitFor(() => expect(saveGlobalSettingsRPC.submit).toHaveBeenCalled())
  act(() => {
    saveGlobalSettingsRPC.resolveNext(undefined)
  })

  await waitFor(() => {
    expect(result.current.allowEdit).toBe(true)
    expect(snapshotGroups(result.current.groups)).toEqual(previousGroups)
  })
  expect(warnSpy).toHaveBeenCalledWith(
    'Failed to save notification settings',
    expect.any(Error)
  )
})
