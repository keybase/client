/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'

// the popup's chrome is electron/native-only; the mocks keep what the tests drive
// (button labels, the restrict dropdown, text) and drop the rest
jest.mock('@/common-adapters', () => {
  const R = jest.requireActual<typeof React>('react')
  const passThrough = ({children}: {children?: React.ReactNode}) => R.createElement('div', null, children)
  const button = (p: {disabled?: boolean; label: string; onClick: () => void}) =>
    R.createElement('button', {disabled: !!p.disabled, onClick: p.onClick}, p.label)
  const anyStyle: unknown = new Proxy(
    {
      createStyleHook: () => () => ({}),
      globalMargins: new Proxy({}, {get: () => 0}),
      globalStyles: new Proxy({}, {get: () => ({})}),
      useTheme: () => ({redDark: 'red'}),
    },
    {get: (t: {[key: string]: unknown}, k) => (typeof k === 'string' && k in t ? t[k] : () => ({}))}
  )
  const components: {[key: string]: unknown} = {
    Avatar: () => null,
    Button: button,
    Checkbox: (p: {labelComponent: React.ReactNode}) => R.createElement('div', null, p.labelComponent),
    Dropdown: (p: {items: ReadonlyArray<React.ReactNode>; onChangedIdx: (i: number) => void}) =>
      R.createElement(
        'div',
        null,
        p.items.map((item, i) => R.createElement('button', {key: i, onClick: () => p.onChangedIdx(i)}, item))
      ),
    LoadingScreen: () => R.createElement('span', null, 'loading'),
    NameWithIcon: (p: {username: string}) => R.createElement('span', null, p.username),
    ProgressIndicator: () => R.createElement('span', null, 'progress'),
    Styles: anyStyle,
    Text: (p: {children?: React.ReactNode; onClick?: () => void}) => R.createElement('span', {onClick: p.onClick}, p.children),
    WaitingButton: button,
  }
  return new Proxy(components, {
    get: (t, k) => (k === '__esModule' ? true : typeof k === 'string' && k in t ? t[k] : passThrough),
  })
})
let mockMeta: unknown
let mockChannelMetas: ReadonlyMap<string, unknown> = new Map()
jest.mock('../data-hooks', () => ({useConversationMeta: () => mockMeta}))
jest.mock('../team-hooks', () => ({useChatTeam: () => ({yourOperations: {manageBots: true}})}))
jest.mock('@/teams/common/channel-hooks', () => ({useAllChannelMetas: () => ({channelMetas: mockChannelMetas})}))
jest.mock('@/teams/common/general-conv', () => ({useGeneralConvIDKey: () => undefined}))
jest.mock('@/util/featured-bots', () => ({useFeaturedBot: () => undefined}))
jest.mock('./channel-picker', () => ({__esModule: true, default: () => null}))

import {act, cleanup, fireEvent, render, renderHook, screen} from '@testing-library/react'
import * as C from '@/constants'
import * as Meta from '@/constants/chat/meta'
import * as Router from '@/constants/router'
import * as T from '@/constants/types'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import {resetAllStores} from '@/util/zustand'
import {useWaitingState} from '@/stores/waiting'
import {useInboxMetadataState} from '@/chat/inbox/metadata'
import {useBotSettings} from './settings'
import InstallBotPopup, {useBotTeamRole, useRefreshBotMembershipOnSuccess} from './install'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const otherConvID = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

test('useBotTeamRole refreshes role for the selected conversation and ignores stale results', async () => {
  const resolvers = new Map<string, (role: T.RPCGen.TeamRole) => void>()
  jest.spyOn(T.RPCChat, 'localGetTeamRoleInConversationRpcPromise').mockImplementation(
    async ({username}) => {
      const role = await new Promise<T.RPCGen.TeamRole>(resolve => {
        resolvers.set(username, resolve)
      })
      return role
    }
  )

  const {rerender, result} = renderHook(
    ({botUsername, id}) => useBotTeamRole(id, botUsername),
    {initialProps: {botUsername: 'helperbot', id: convID}}
  )

  expect(T.RPCChat.localGetTeamRoleInConversationRpcPromise).toHaveBeenCalledWith({
    convID: T.Chat.keyToConversationID(convID),
    username: 'helperbot',
  })

  rerender({botUsername: 'otherbot', id: convID})
  expect(T.RPCChat.localGetTeamRoleInConversationRpcPromise).toHaveBeenLastCalledWith({
    convID: T.Chat.keyToConversationID(convID),
    username: 'otherbot',
  })

  await act(async () => {
    resolvers.get('helperbot')?.(T.RPCGen.TeamRole.bot)
    await flushPromises()
  })

  expect(result.current).toBeUndefined()

  await act(async () => {
    resolvers.get('otherbot')?.(T.RPCGen.TeamRole.restrictedbot)
    await flushPromises()
  })

  expect(result.current).toBe('restrictedbot')
})

test('useBotSettings refreshes only when enabled and hides stale conversation data', async () => {
  const settings = {cmds: true, convs: [convID], mentions: false}
  jest.spyOn(T.RPCChat, 'localGetBotMemberSettingsRpcPromise').mockResolvedValue(settings)

  const {rerender, result} = renderHook(
    ({enabled, id}) => useBotSettings(id, 'helperbot', enabled),
    {initialProps: {enabled: false, id: convID as T.Chat.ConversationIDKey | undefined}}
  )

  await act(async () => {
    await flushPromises()
  })

  expect(T.RPCChat.localGetBotMemberSettingsRpcPromise).not.toHaveBeenCalled()
  expect(result.current.settings).toBeUndefined()

  rerender({enabled: true, id: convID})
  await act(async () => {
    await flushPromises()
  })

  expect(T.RPCChat.localGetBotMemberSettingsRpcPromise).toHaveBeenCalledWith({
    convID: T.Chat.keyToConversationID(convID),
    username: 'helperbot',
  })
  expect(result.current.settings).toEqual(settings)

  rerender({enabled: true, id: otherConvID})

  expect(result.current.settings).toBeUndefined()

  await act(async () => {
    await flushPromises()
  })

  expect(T.RPCChat.localGetBotMemberSettingsRpcPromise).toHaveBeenLastCalledWith({
    convID: T.Chat.keyToConversationID(otherConvID),
    username: 'helperbot',
  })
  expect(result.current.settings).toEqual(settings)
})

test('useBotTeamRole logs a failed getTeamRoleInConversation and reports no role', async () => {
  const info = jest.spyOn(logger, 'info').mockImplementation(() => {})
  jest
    .spyOn(T.RPCChat, 'localGetTeamRoleInConversationRpcPromise')
    .mockRejectedValue(new RPCError('no such conv', 6))

  const {result} = renderHook(() => useBotTeamRole(convID, 'helperbot'))
  await act(async () => {
    await flushPromises()
  })

  expect(result.current).toBeUndefined()
  expect(info).toHaveBeenCalledWith('useBotTeamRole: failed to refresh bot team role: ERROR CODE 6 - no such conv')
})

test('useBotTeamRole does not call the service without a conversation', () => {
  const load = jest.spyOn(T.RPCChat, 'localGetTeamRoleInConversationRpcPromise')
  const {result} = renderHook(() => useBotTeamRole(undefined, 'helperbot'))
  expect(load).not.toHaveBeenCalled()
  expect(result.current).toBeUndefined()
})

const settle = async () => {
  await act(async () => {
    for (let i = 0; i < 20; i++) {
      await Promise.resolve()
    }
  })
}

// mirrors what the engine does for a call made with a waiting key: count it while in
// flight, and on settle drop the count, recording the error on a failure
const settleWithWaiting = async <R,>(
  outcome: {error: unknown} | {result: R},
  waitingKey?: string | ReadonlyArray<string>
): Promise<R> => {
  const {dispatch} = useWaitingState.getState()
  if (waitingKey) dispatch.increment(waitingKey)
  await Promise.resolve()
  if ('error' in outcome) {
    if (waitingKey) dispatch.decrement(waitingKey, outcome.error as RPCError)
    throw outcome.error
  }
  if (waitingKey) dispatch.decrement(waitingKey)
  return outcome.result
}

const deferred = <R,>() => {
  let settle: {reject: (e: unknown) => void; resolve: (r: R) => void} = {reject: () => {}, resolve: () => {}}
  const promise = new Promise<R>((resolve, reject) => {
    settle = {reject, resolve}
  })
  return {promise, reject: (e: unknown) => settle.reject(e), resolve: (r: R) => settle.resolve(r)}
}

const previewResult = (participants: Array<string>) =>
  ({
    conv: {
      participants: participants.map(assertion => ({
        assertion,
        inConvName: true,
        type: T.RPCChat.UIParticipantType.user,
      })),
    },
  }) as unknown as T.RPCChat.PreviewConversationLocalRes

describe('useRefreshBotMembershipOnSuccess', () => {
  const waitingKey = 'test:botMutation'
  const run = (p: {
    conversationIDKey: T.Chat.ConversationIDKey | undefined
    error?: RPCError
    shouldRefresh: boolean
  }) => {
    const onSuccess = jest.fn()
    renderHook(() =>
      useRefreshBotMembershipOnSuccess(p.conversationIDKey, waitingKey, p.error, p.shouldRefresh, onSuccess)
    )
    return onSuccess
  }
  const waitThenFinish = async () => {
    act(() => {
      useWaitingState.getState().dispatch.increment(waitingKey)
    })
    act(() => {
      useWaitingState.getState().dispatch.decrement(waitingKey)
    })
    await settle()
  }

  test('does nothing on mount or while nothing was waiting', async () => {
    const preview = jest.spyOn(T.RPCChat, 'localPreviewConversationByIDLocalRpcPromise')
    const onSuccess = run({conversationIDKey: convID, shouldRefresh: true})
    await settle()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(preview).not.toHaveBeenCalled()
  })

  test('previews the conversation, stores its participants, then calls onSuccess', async () => {
    const preview = jest
      .spyOn(T.RPCChat, 'localPreviewConversationByIDLocalRpcPromise')
      .mockResolvedValue(previewResult(['testuser', 'helperbot']))
    const onSuccess = run({conversationIDKey: convID, shouldRefresh: true})
    await waitThenFinish()

    expect(preview).toHaveBeenCalledTimes(1)
    expect(preview.mock.calls[0]).toEqual([{convID: T.Chat.keyToConversationID(convID)}])
    expect(useInboxMetadataState.getState().participants.get(convID)).toEqual({
      all: ['testuser', 'helperbot'],
      contactName: new Map(),
      name: ['testuser', 'helperbot'],
    })
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  test('a failed preview still calls onSuccess and stores nothing', async () => {
    jest
      .spyOn(T.RPCChat, 'localPreviewConversationByIDLocalRpcPromise')
      .mockRejectedValue(new RPCError('offline', 2))
    const onSuccess = run({conversationIDKey: convID, shouldRefresh: true})
    await waitThenFinish()

    expect(useInboxMetadataState.getState().participants.get(convID)).toBeUndefined()
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  test('skips the preview when no refresh is wanted', async () => {
    const preview = jest.spyOn(T.RPCChat, 'localPreviewConversationByIDLocalRpcPromise')
    const onSuccess = run({conversationIDKey: convID, shouldRefresh: false})
    await waitThenFinish()
    expect(preview).not.toHaveBeenCalled()
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  test('skips the preview for a missing or invalid conversation', async () => {
    const preview = jest.spyOn(T.RPCChat, 'localPreviewConversationByIDLocalRpcPromise')
    const onMissing = run({conversationIDKey: undefined, shouldRefresh: true})
    await waitThenFinish()
    const onInvalid = run({conversationIDKey: T.Chat.noConversationIDKey, shouldRefresh: true})
    await waitThenFinish()
    expect(preview).not.toHaveBeenCalled()
    // the first hook sees both waiting cycles
    expect(onMissing).toHaveBeenCalledTimes(2)
    expect(onInvalid).toHaveBeenCalledTimes(1)
  })

  test('does nothing when the mutation ended in an error', async () => {
    const preview = jest.spyOn(T.RPCChat, 'localPreviewConversationByIDLocalRpcPromise')
    const onSuccess = run({conversationIDKey: convID, error: new RPCError('nope', 1), shouldRefresh: true})
    await waitThenFinish()
    expect(preview).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })
})

describe('InstallBotPopup service calls', () => {
  const teamID = 'team1'
  const chanA = T.Chat.conversationIDToKey(new Uint8Array([9, 9]))
  const goneChan = T.Chat.conversationIDToKey(new Uint8Array([8, 8]))
  let clearModals: jest.SpyInstance
  let info: jest.SpyInstance

  const setMeta = (botCommands?: T.RPCChat.ConversationCommandGroups) => {
    mockMeta = {
      ...Meta.makeConversationMeta(),
      ...(botCommands ? {botCommands} : {}),
      conversationIDKey: convID,
      teamID,
      teamname: 'acme',
    }
  }

  const mockRole = (role: T.RPCGen.TeamRole) =>
    jest.spyOn(T.RPCChat, 'localGetTeamRoleInConversationRpcPromise').mockResolvedValue(role)

  const mockPublicCommands = (names: Array<string>) =>
    jest.spyOn(T.RPCChat, 'localListPublicBotCommandsLocalRpcPromise').mockResolvedValue({
      commands: names.map(name => ({description: '', name, usage: '', username: 'helperbot'})),
    })

  const mockPreview = () =>
    jest
      .spyOn(T.RPCChat, 'localPreviewConversationByIDLocalRpcPromise')
      .mockResolvedValue(previewResult(['testuser', 'helperbot']))

  const renderPopup = async (botUsername = 'helperbot') => {
    const r = render(<InstallBotPopup botUsername={botUsername} conversationIDKey={convID} />)
    await settle()
    return r
  }

  const click = async (text: string) => {
    fireEvent.click(screen.getByText(text))
    await settle()
  }

  beforeEach(() => {
    setMeta()
    mockChannelMetas = new Map([[chanA, {channelname: 'random'}]])
    clearModals = jest.spyOn(Router, 'clearModals').mockImplementation(() => {})
    info = jest.spyOn(logger, 'info').mockImplementation(() => {})
  })

  describe('install (addBotMember)', () => {
    test('a restricted install sends the chosen read settings as restrictedbot, then refreshes and closes', async () => {
      mockRole(T.RPCGen.TeamRole.none)
      mockPublicCommands([])
      const settingsLoad = jest.spyOn(T.RPCChat, 'localGetBotMemberSettingsRpcPromise')
      const add = jest
        .spyOn(T.RPCChat, 'localAddBotMemberRpcPromise')
        .mockImplementation(async (_p, waitingKey) => settleWithWaiting({result: undefined}, waitingKey))
      const preview = mockPreview()

      await renderPopup()
      // not in the team yet, so there are no member settings to load
      expect(settingsLoad).not.toHaveBeenCalled()
      await click('Review')
      await click('Install')

      expect(add).toHaveBeenCalledTimes(1)
      expect(add).toHaveBeenCalledWith(
        {
          botSettings: {cmds: true, convs: [], mentions: true},
          convID: T.Chat.keyToConversationID(convID),
          role: T.RPCGen.TeamRole.restrictedbot,
          username: 'helperbot',
        },
        C.waitingKeyChatBotAdd
      )
      expect(C.waitingKeyChatBotAdd).toBe('chat:botAdd')
      expect(preview).toHaveBeenCalledWith({convID: T.Chat.keyToConversationID(convID)})
      expect(useInboxMetadataState.getState().participants.get(convID)?.all).toEqual(['testuser', 'helperbot'])
      expect(clearModals).toHaveBeenCalledTimes(1)
      expect(info).not.toHaveBeenCalled()
    })

    test('an unrestricted install sends no bot settings and the bot role', async () => {
      mockRole(T.RPCGen.TeamRole.none)
      mockPublicCommands([])
      const add = jest
        .spyOn(T.RPCChat, 'localAddBotMemberRpcPromise')
        .mockImplementation(async (_p, waitingKey) => settleWithWaiting({result: undefined}, waitingKey))
      mockPreview()

      await renderPopup()
      await click('Unrestricted bot')
      await click('Review')
      await click('Install')

      expect(add).toHaveBeenCalledWith(
        {
          botSettings: null,
          convID: T.Chat.keyToConversationID(convID),
          role: T.RPCGen.TeamRole.bot,
          username: 'helperbot',
        },
        'chat:botAdd'
      )
      expect(clearModals).toHaveBeenCalledTimes(1)
    })

    test('a failed install is logged, shows the error line, and neither refreshes nor closes', async () => {
      mockRole(T.RPCGen.TeamRole.none)
      mockPublicCommands([])
      jest
        .spyOn(T.RPCChat, 'localAddBotMemberRpcPromise')
        .mockImplementation(async (_p, waitingKey) =>
          settleWithWaiting({error: new RPCError('team is full', 7)}, waitingKey)
        )
      const preview = jest.spyOn(T.RPCChat, 'localPreviewConversationByIDLocalRpcPromise')

      await renderPopup()
      await click('Review')
      await click('Install')

      expect(info).toHaveBeenCalledWith('addBotMember: failed to add bot member: ERROR CODE 7 - team is full')
      expect(screen.getByText('Something went wrong! Please try again, or send')).toBeTruthy()
      expect(preview).not.toHaveBeenCalled()
      expect(clearModals).not.toHaveBeenCalled()
    })
  })

  describe('edit (setBotMemberSettings)', () => {
    const renderInstalled = async (settings: T.RPCGen.TeamBotSettings) => {
      mockRole(T.RPCGen.TeamRole.restrictedbot)
      mockPublicCommands([])
      const settingsLoad = jest
        .spyOn(T.RPCChat, 'localGetBotMemberSettingsRpcPromise')
        .mockResolvedValue(settings)
      await renderPopup()
      expect(settingsLoad).toHaveBeenCalledWith({
        convID: T.Chat.keyToConversationID(convID),
        username: 'helperbot',
      })
    }

    test('saving sends the edited settings with the add waiting key, then refreshes and closes', async () => {
      const set = jest
        .spyOn(T.RPCChat, 'localSetBotMemberSettingsRpcPromise')
        .mockImplementation(async (_p, waitingKey) => settleWithWaiting({result: undefined}, waitingKey))
      const preview = mockPreview()

      await renderInstalled({cmds: true, convs: [chanA], mentions: false})
      await click('Edit settings')
      await click('Save')

      expect(set).toHaveBeenCalledTimes(1)
      expect(set).toHaveBeenCalledWith(
        {
          botSettings: {cmds: true, convs: [chanA], mentions: false},
          convID: T.Chat.keyToConversationID(convID),
          username: 'helperbot',
        },
        C.waitingKeyChatBotAdd
      )
      expect(preview).toHaveBeenCalledWith({convID: T.Chat.keyToConversationID(convID)})
      expect(clearModals).toHaveBeenCalledTimes(1)
    })

    test('channels that no longer exist are dropped from what is saved', async () => {
      const set = jest
        .spyOn(T.RPCChat, 'localSetBotMemberSettingsRpcPromise')
        .mockImplementation(async (_p, waitingKey) => settleWithWaiting({result: undefined}, waitingKey))
      mockPreview()

      await renderInstalled({cmds: false, convs: [chanA, goneChan], mentions: true})
      await click('Edit settings')
      await click('Save')
      expect(set.mock.calls[0]?.[0].botSettings).toEqual({cmds: false, convs: [chanA], mentions: true})
    })

    test('an all-channels bot saves an empty convs list', async () => {
      const set = jest
        .spyOn(T.RPCChat, 'localSetBotMemberSettingsRpcPromise')
        .mockImplementation(async (_p, waitingKey) => settleWithWaiting({result: undefined}, waitingKey))
      mockPreview()

      await renderInstalled({cmds: true, convs: null, mentions: true})
      await click('Edit settings')
      await click('Save')
      expect(set.mock.calls[0]?.[0].botSettings).toEqual({cmds: true, convs: [], mentions: true})
    })

    test('a failed save is logged, shows the error line, and neither refreshes nor closes', async () => {
      jest
        .spyOn(T.RPCChat, 'localSetBotMemberSettingsRpcPromise')
        .mockImplementation(async (_p, waitingKey) =>
          settleWithWaiting({error: new RPCError('denied', 8)}, waitingKey)
        )
      const preview = jest.spyOn(T.RPCChat, 'localPreviewConversationByIDLocalRpcPromise')

      await renderInstalled({cmds: true, convs: [chanA], mentions: false})
      await click('Edit settings')
      await click('Save')

      expect(info).toHaveBeenCalledWith('addBotMember: failed to edit bot settings: ERROR CODE 8 - denied')
      expect(screen.getByText('Something went wrong! Please try again, or send')).toBeTruthy()
      expect(preview).not.toHaveBeenCalled()
      expect(clearModals).not.toHaveBeenCalled()
    })
  })

  describe('public bot commands (listPublicBotCommandsLocal)', () => {
    test('loads the commands by username (no waiting key) when the conversation has none', async () => {
      mockRole(T.RPCGen.TeamRole.none)
      const list = mockPublicCommands(['help', 'weather'])

      await renderPopup()
      await click('Review')

      expect(list).toHaveBeenCalledTimes(1)
      expect(list.mock.calls[0]).toEqual([{username: 'helperbot'}])
      expect(screen.getByText('• !help')).toBeTruthy()
      expect(screen.getByText('• !weather')).toBeTruthy()
    })

    test('a failed load shows the load error, without a log', async () => {
      mockRole(T.RPCGen.TeamRole.none)
      jest
        .spyOn(T.RPCChat, 'localListPublicBotCommandsLocalRpcPromise')
        .mockRejectedValue(new RPCError('unknown bot', 9))

      await renderPopup()
      await click('Review')

      expect(screen.getByText('Error loading bot public commands.')).toBeTruthy()
      expect(info).not.toHaveBeenCalled()
    })

    test('a late result for the previous bot is dropped', async () => {
      mockRole(T.RPCGen.TeamRole.none)
      const helper = deferred<T.RPCChat.ListBotCommandsLocalRes>()
      const other = deferred<T.RPCChat.ListBotCommandsLocalRes>()
      const list = jest
        .spyOn(T.RPCChat, 'localListPublicBotCommandsLocalRpcPromise')
        .mockImplementation(async ({username}) => (username === 'helperbot' ? helper.promise : other.promise))

      const {rerender} = await renderPopup()
      await click('Review')
      rerender(<InstallBotPopup botUsername="otherbot" conversationIDKey={convID} />)
      await settle()
      expect(list.mock.calls.map(c => c[0])).toEqual([{username: 'helperbot'}, {username: 'otherbot'}])

      other.resolve({commands: [{description: '', name: 'other', usage: '', username: 'otherbot'}]})
      await settle()
      helper.resolve({commands: [{description: '', name: 'stale', usage: '', username: 'helperbot'}]})
      await settle()

      expect(screen.getByText('• !other')).toBeTruthy()
      expect(screen.queryByText('• !stale')).toBeNull()
    })

    test('skips the load when the conversation already lists the bot commands', async () => {
      mockRole(T.RPCGen.TeamRole.none)
      setMeta({
        custom: {
          commands: [
            {description: '', hasHelpText: false, name: 'fromMeta', usage: '', username: 'helperbot'},
            {description: '', hasHelpText: false, name: 'someoneElse', usage: '', username: 'otherbot'},
          ],
        },
        typ: T.RPCChat.ConversationCommandGroupsTyp.custom,
      })
      const list = jest.spyOn(T.RPCChat, 'localListPublicBotCommandsLocalRpcPromise')

      await renderPopup()
      await click('Review')

      expect(list).not.toHaveBeenCalled()
      expect(screen.getByText('• !fromMeta')).toBeTruthy()
      expect(screen.queryByText('• !someoneElse')).toBeNull()
    })
  })
})
