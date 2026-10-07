/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import {act, cleanup, fireEvent, render, renderHook, screen} from '@testing-library/react'
import * as C from '@/constants'
import * as T from '@/constants/types'
import logger from '@/logger'
import {makeConversationMeta} from '@/constants/chat/meta'
import {useInboxMetadataState} from '@/chat/inbox/metadata'
import {resetAllStores} from '@/util/zustand'
import {flush} from '@/test/flush'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
import {useBotSettings} from '../bot/settings'

let mockMeta: T.Chat.ConversationMeta = makeConversationMeta()
let mockParticipants: T.Chat.ParticipantInfo = {all: [], contactName: new Map(), name: []}
const mockReloadTeamMembers = jest.fn(async () => {})
jest.mock('../data-hooks', () => ({
  ...jest.requireActual<object>('../data-hooks'),
  useConversationMetadata: () => ({meta: mockMeta, participants: mockParticipants}),
}))
jest.mock('../team-hooks', () => ({
  ...jest.requireActual<object>('../team-hooks'),
  useChatTeam: () => ({yourOperations: {manageBots: true}}),
  useChatTeamMembers: () => ({loading: false, members: new Map(), reload: mockReloadTeamMembers}),
}))
// Avatar and the tooltip inside WaitingButton need native modules jsdom lacks, and the
// virtualized list does not render here; the bot tab tests only exercise its effects. The
// button stand-in keeps what the tests read: its handler, disabled state and waiting key
jest.mock('@/common-adapters', () => {
  const R = jest.requireActual<typeof React>('react')
  return {
    ...jest.requireActual<object>('@/common-adapters'),
    Avatar: () => null,
    SectionList: () => null,
    WaitingButton: (p: {
      children?: React.ReactNode
      disabled?: boolean
      onClick: (e: React.MouseEvent) => void
      tooltip?: string
      waitingKey: string
    }) =>
      R.createElement(
        'button',
        {'data-waiting-key': p.waitingKey, disabled: p.disabled, onClick: p.onClick, title: p.tooltip},
        p.children
      ),
  }
})

import BotTab, {Bot} from './bot'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

let rpc: FakeChatRpc

beforeEach(() => {
  rpc = installFakeChatRpc()
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  restoreChatRpc()
  resetAllStores()
  mockMeta = makeConversationMeta()
  mockParticipants = {all: [], contactName: new Map(), name: []}
  mockReloadTeamMembers.mockClear()
})

test('useBotSettings refreshes settings for the visible bot and supports local updates after edits', async () => {
  const initialSettings = {cmds: true, convs: ['old-conv'], mentions: false}
  const editedSettings = {cmds: true, convs: [convID, 'old-conv'], mentions: false}
  rpc.on('getBotSettings', () => initialSettings)

  const {result} = renderHook(() => useBotSettings(convID, 'helperbot'))

  await act(async () => {
    await flushPromises()
  })

  expect(rpc.calls('getBotSettings')).toContainEqual([convID, 'helperbot'])
  expect(result.current.settings).toEqual(initialSettings)

  act(() => {
    result.current.setSettings(editedSettings)
  })

  expect(result.current.settings).toEqual(editedSettings)
})

test('useBotSettings clears visible settings while refreshing a different bot', async () => {
  rpc.on(
    'getBotSettings',
    async (_conversationIDKey, username) => {
      await Promise.resolve()
      return username === 'helperbot'
        ? {cmds: true, convs: ['helper-conv'], mentions: false}
        : {cmds: false, convs: ['other-conv'], mentions: true}
    }
  )

  const {rerender, result} = renderHook(({username}) => useBotSettings(convID, username), {
    initialProps: {username: 'helperbot'},
  })

  await act(async () => {
    await flushPromises()
  })

  expect(result.current.settings).toEqual({cmds: true, convs: ['helper-conv'], mentions: false})

  rerender({username: 'otherbot'})

  expect(result.current.settings).toBeUndefined()

  await act(async () => {
    await flushPromises()
  })

  expect(result.current.settings).toEqual({cmds: false, convs: ['other-conv'], mentions: true})
})

const uiParticipant = (assertion: string, inConvName = false): T.RPCChat.UIParticipant => ({
  assertion,
  inConvName,
  type: T.RPCChat.UIParticipantType.user,
})

// only participants is read from the preview
const previewWith = (participants: Array<T.RPCChat.UIParticipant>) =>
  ({participants}) as unknown as T.RPCChat.InboxUIItem

const storedParticipants = () => useInboxMetadataState.getState().participants.get(convID)

describe('add-to-channel button', () => {
  const renderBot = () =>
    render(
      <Bot
        botAlias=""
        botUsername="testbot"
        conversationIDKey={convID}
        description=""
        extendedDescription=""
        extendedDescriptionRaw=""
        isPromoted={false}
        onClick={() => {}}
        rank={0}
        showChannelAdd={true}
      />
    )
  const addButton = () => screen.getByTitle(/channel/)

  const mockSettings = (settings: T.RPCGen.TeamBotSettings) => rpc.on('getBotSettings', () => settings)

  test('adds this channel to the bot settings under the bot-add waiting key, then refreshes participants', async () => {
    mockSettings({cmds: true, convs: ['other-conv'], mentions: false})
    rpc.on('previewConversation', () => previewWith([uiParticipant('testuser', true), uiParticipant('testbot')]))
    renderBot()
    await flush()

    expect(addButton().getAttribute('data-waiting-key')).toBe(C.waitingKeyChatBotAdd)
    fireEvent.click(addButton())
    await flush()

    expect(rpc.calls('setBotSettings')).toEqual([
      [
        {
          conversationIDKey: convID,
          settings: {cmds: true, convs: [convID, 'other-conv'], mentions: false},
          username: 'testbot',
          waitingKey: C.waitingKeyChatBotAdd,
        },
      ],
    ])
    expect(rpc.calls('previewConversation')).toEqual([[convID]])
    expect(
      rpc.log.map(c => c.method).filter(m => m === 'setBotSettings' || m === 'previewConversation')
    ).toEqual(['setBotSettings', 'previewConversation'])
    expect(storedParticipants()).toEqual({
      all: ['testuser', 'testbot'],
      contactName: new Map(),
      name: ['testuser'],
    })
  })

  test('after a successful add the local settings include this channel, so a second click sends nothing', async () => {
    mockSettings({cmds: true, convs: ['other-conv'], mentions: false})
    rpc.on('previewConversation', () => previewWith([]))
    renderBot()
    await flush()

    fireEvent.click(addButton())
    await flush()
    fireEvent.click(addButton())
    await flush()

    expect(rpc.calls('setBotSettings')).toHaveLength(1)
  })

  test('a bot that already reads every channel (empty convs) is disabled and sends nothing', async () => {
    mockSettings({cmds: true, convs: [], mentions: false})
    renderBot()
    await flush()

    expect(addButton().title).toBe('Already in all channels')
    expect(addButton().hasAttribute('disabled')).toBe(true)
    fireEvent.click(addButton())
    await flush()

    expect(rpc.calls('setBotSettings')).toEqual([])
  })

  test('a bot whose settings already list this channel sends nothing', async () => {
    mockSettings({cmds: true, convs: [convID], mentions: false})
    renderBot()
    await flush()

    fireEvent.click(addButton())
    await flush()

    expect(rpc.calls('setBotSettings')).toEqual([])
  })

  test('a failed settings edit is only logged: no participant refresh, and a retry resends the same settings', async () => {
    mockSettings({cmds: true, convs: ['other-conv'], mentions: false})
    rpc.fail('setBotSettings', new Error('not allowed'))
    const logInfo = jest.spyOn(logger, 'info').mockImplementation(() => {})
    const {container} = renderBot()
    await flush()

    fireEvent.click(addButton())
    await flush()

    expect(logInfo).toHaveBeenCalledWith('AddToChannel: failed to edit bot settings: not allowed')
    expect(rpc.calls('previewConversation')).toEqual([])
    expect(container.textContent).not.toContain('not allowed')

    fireEvent.click(addButton())
    await flush()

    const sets = rpc.calls('setBotSettings')
    expect(sets).toHaveLength(2)
    expect(sets[1]).toEqual(sets[0])
  })

  test('a failed participant refresh after a successful add is swallowed silently', async () => {
    mockSettings({cmds: true, convs: ['other-conv'], mentions: false})
    rpc.fail('previewConversation', new Error('preview failed'))
    const logInfo = jest.spyOn(logger, 'info')
    const logError = jest.spyOn(logger, 'error')
    renderBot()
    await flush()

    fireEvent.click(addButton())
    await flush()

    expect(storedParticipants()).toBeUndefined()
    expect(logInfo).not.toHaveBeenCalled()
    expect(logError).not.toHaveBeenCalled()
  })
})

describe('BotTab participant previews', () => {
  const renderBotTab = () => render(<BotTab commonSections={[]} conversationIDKey={convID} />)

  beforeEach(() => {
    jest.spyOn(T.RPCGen, 'featuredBotFeaturedBotsRpcPromise').mockResolvedValue({bots: [], isLastPage: true})
  })

  const adhocMeta = (): T.Chat.ConversationMeta => ({...makeConversationMeta(), conversationIDKey: convID, teamType: 'adhoc'})
  const bigTeamMeta = (): T.Chat.ConversationMeta => ({
    ...makeConversationMeta(),
    channelname: 'random',
    conversationIDKey: convID,
    teamID: 'team-1',
    teamType: 'big',
    teamname: 'acme',
  })

  test('an adhoc conversation with participants but no names asks for a preview to repair them', async () => {
    mockMeta = adhocMeta()
    mockParticipants = {all: ['testuser', 'testbot'], contactName: new Map(), name: []}
    rpc.on('previewConversation', () => previewWith([uiParticipant('testuser', true), uiParticipant('testbot')]))

    renderBotTab()
    await flush()

    expect(rpc.calls('previewConversation')).toEqual([[convID]])
    expect(storedParticipants()).toEqual({
      all: ['testuser', 'testbot'],
      contactName: new Map(),
      name: ['testuser'],
    })
  })

  test('the adhoc repair runs once per conversation, not on every render', async () => {
    mockMeta = adhocMeta()
    mockParticipants = {all: ['testuser', 'testbot'], contactName: new Map(), name: []}
    rpc.on('previewConversation', () => previewWith([]))

    const {rerender} = renderBotTab()
    await flush()
    mockParticipants = {all: ['testuser', 'testbot', 'otherbot'], contactName: new Map(), name: []}
    rerender(<BotTab commonSections={[]} conversationIDKey={convID} />)
    await flush()

    expect(rpc.calls('previewConversation')).toHaveLength(1)
  })

  test.each([
    ['names are already known', {all: ['testuser', 'testbot'], contactName: new Map(), name: ['testuser']}],
    ['there are no participants yet', {all: [], contactName: new Map(), name: []}],
  ])('no adhoc repair when %s', async (_label, participants: T.Chat.ParticipantInfo) => {
    mockMeta = adhocMeta()
    mockParticipants = participants

    renderBotTab()
    await flush()

    expect(rpc.calls('previewConversation')).toEqual([])
  })

  test('a team conversation never runs the adhoc repair', async () => {
    mockMeta = bigTeamMeta()
    mockParticipants = {all: ['testuser', 'testbot'], contactName: new Map(), name: []}

    renderBotTab()
    await flush()

    expect(rpc.calls('previewConversation')).toEqual([])
  })

  test('a failed adhoc repair is swallowed silently', async () => {
    mockMeta = adhocMeta()
    mockParticipants = {all: ['testuser', 'testbot'], contactName: new Map(), name: []}
    rpc.fail('previewConversation', new Error('preview failed'))
    const logInfo = jest.spyOn(logger, 'info')
    const logError = jest.spyOn(logger, 'error')

    renderBotTab()
    await flush()

    expect(storedParticipants()).toBeUndefined()
    expect(logInfo).not.toHaveBeenCalled()
    expect(logError).not.toHaveBeenCalled()
  })

  const runMutation = async (key: T.Waiting.WaitingKeys, error?: Error) => {
    act(() => {
      C.useWaitingState.getState().dispatch.increment(key)
    })
    await flush()
    act(() => {
      C.useWaitingState.getState().dispatch.decrement(key, error as never)
    })
    await flush()
  }

  test.each([
    ['add', C.waitingKeyChatBotAdd],
    ['remove', C.waitingKeyChatBotRemove],
  ] as const)('when a bot %s finishes, a team conversation refreshes its participants and team members', async (_label, key) => {
    mockMeta = bigTeamMeta()
    rpc.on('previewConversation', () => previewWith([uiParticipant('testuser', true), uiParticipant('testbot')]))

    renderBotTab()
    await flush()
    expect(rpc.calls('previewConversation')).toEqual([])

    await runMutation(key)

    expect(rpc.calls('previewConversation')).toHaveLength(1)
    expect(rpc.calls('previewConversation')).toEqual([[convID]])
    expect(storedParticipants()?.all).toEqual(['testuser', 'testbot'])
    expect(mockReloadTeamMembers).toHaveBeenCalledTimes(1)
  })

  test('when a bot mutation finishes in an adhoc conversation, only the participants are refreshed', async () => {
    mockMeta = adhocMeta()
    mockParticipants = {all: ['testuser', 'testbot'], contactName: new Map(), name: ['testuser']}
    rpc.on('previewConversation', () => previewWith([]))

    renderBotTab()
    await flush()
    await runMutation(C.waitingKeyChatBotAdd)

    expect(rpc.calls('previewConversation')).toHaveLength(1)
    expect(mockReloadTeamMembers).not.toHaveBeenCalled()
  })

  test('a bot mutation that ended in an error refreshes nothing', async () => {
    mockMeta = bigTeamMeta()

    renderBotTab()
    await flush()
    await runMutation(C.waitingKeyChatBotAdd, new Error('add failed'))

    expect(rpc.calls('previewConversation')).toEqual([])
    expect(mockReloadTeamMembers).not.toHaveBeenCalled()
  })

  test('a failed refresh after a bot mutation is swallowed silently', async () => {
    mockMeta = bigTeamMeta()
    rpc.fail('previewConversation', new Error('preview failed'))
    const logInfo = jest.spyOn(logger, 'info')
    const logError = jest.spyOn(logger, 'error')

    renderBotTab()
    await flush()
    await runMutation(C.waitingKeyChatBotAdd)

    expect(storedParticipants()).toBeUndefined()
    expect(logInfo).not.toHaveBeenCalled()
    expect(logError).not.toHaveBeenCalled()
    expect(mockReloadTeamMembers).toHaveBeenCalledTimes(1)
  })
})
