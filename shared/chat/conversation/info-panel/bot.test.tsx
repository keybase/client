/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import {act, cleanup, fireEvent, render, renderHook, screen} from '@testing-library/react'
import * as C from '@/constants'
import * as T from '@/constants/types'
import logger from '@/logger'
import {makeConversationMeta} from '@/constants/chat/meta'
import {metasReceived, participantInfoReceived, useInboxMetadataState} from '@/chat/inbox/metadata'
import {resetAllStores} from '@/util/zustand'
import {flush} from '@/test/flush'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {useBotSettings} from '../bot/settings'

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

const getBotSettings = 'chat.1.local.getBotMemberSettings'
const setBotSettings = 'chat.1.local.setBotMemberSettings'
const previewConversation = 'chat.1.local.previewConversationByIDLocal'
const getTeamMembers = 'keybase.1.teams.teamGetMembersByID'
const convIDOf = T.Chat.keyToConversationID

let fake: FakeEngine

beforeEach(() => {
  fake = installFakeEngine()
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

test('useBotSettings refreshes settings for the visible bot and supports local updates after edits', async () => {
  const initialSettings = {cmds: true, convs: ['old-conv'], mentions: false}
  const editedSettings = {cmds: true, convs: [convID, 'old-conv'], mentions: false}
  fake.answer(getBotSettings, () => initialSettings)

  const {result} = renderHook(() => useBotSettings(convID, 'helperbot'))

  await flush()

  expect(paramsOf(fake, getBotSettings)).toEqual([{convID: convIDOf(convID), username: 'helperbot'}])
  expect(result.current.settings).toEqual(initialSettings)

  act(() => {
    result.current.setSettings(editedSettings)
  })

  expect(result.current.settings).toEqual(editedSettings)
})

test('useBotSettings clears visible settings while refreshing a different bot', async () => {
  fake.answer(getBotSettings, (p: {username: string}) =>
    p.username === 'helperbot'
      ? {cmds: true, convs: ['helper-conv'], mentions: false}
      : {cmds: false, convs: ['other-conv'], mentions: true}
  )

  const {rerender, result} = renderHook(({username}) => useBotSettings(convID, username), {
    initialProps: {username: 'helperbot'},
  })

  await flush()

  expect(result.current.settings).toEqual({cmds: true, convs: ['helper-conv'], mentions: false})

  rerender({username: 'otherbot'})

  expect(result.current.settings).toBeUndefined()

  await flush()

  expect(result.current.settings).toEqual({cmds: false, convs: ['other-conv'], mentions: true})
})

const uiParticipant = (assertion: string, inConvName = false): T.RPCChat.UIParticipant => ({
  assertion,
  inConvName,
  type: T.RPCChat.UIParticipantType.user,
})

// only participants is read from the preview
const previewWith = (participants: Array<T.RPCChat.UIParticipant>) => ({
  conv: {participants} as unknown as T.RPCChat.InboxUIItem,
})

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

  const answerSettings = (settings: T.RPCGen.TeamBotSettings) => fake.answer(getBotSettings, () => settings)

  test('adds this channel to the bot settings under the bot-add waiting key, then refreshes participants', async () => {
    answerSettings({cmds: true, convs: ['other-conv'], mentions: false})
    fake.answer(previewConversation, () => previewWith([uiParticipant('testuser', true), uiParticipant('testbot')]))
    const held = fake.hold(setBotSettings)
    renderBot()
    await flush()

    expect(addButton().getAttribute('data-waiting-key')).toBe(C.waitingKeyChatBotAdd)
    fireEvent.click(addButton())
    await flush()
    expect(C.useWaitingState.getState().counts.get(C.waitingKeyChatBotAdd)).toBe(1)
    held[0]!.reply(null)
    await flush()

    expect(paramsOf(fake, setBotSettings)).toEqual([
      {
        botSettings: {cmds: true, convs: [convID, 'other-conv'], mentions: false},
        convID: convIDOf(convID),
        username: 'testbot',
      },
    ])
    expect(paramsOf(fake, previewConversation)).toEqual([{convID: convIDOf(convID)}])
    expect(
      fake.calls.map(c => c.method).filter(m => m === setBotSettings || m === previewConversation)
    ).toEqual([setBotSettings, previewConversation])
    expect(storedParticipants()).toEqual({
      all: ['testuser', 'testbot'],
      contactName: new Map(),
      name: ['testuser'],
    })
  })

  test('after a successful add the local settings include this channel, so a second click sends nothing', async () => {
    answerSettings({cmds: true, convs: ['other-conv'], mentions: false})
    fake.answer(previewConversation, () => previewWith([]))
    fake.answer(setBotSettings, () => null)
    renderBot()
    await flush()

    fireEvent.click(addButton())
    await flush()
    fireEvent.click(addButton())
    await flush()

    expect(paramsOf(fake, setBotSettings)).toHaveLength(1)
  })

  test('a bot that already reads every channel (empty convs) is disabled and sends nothing', async () => {
    answerSettings({cmds: true, convs: [], mentions: false})
    renderBot()
    await flush()

    expect(addButton().title).toBe('Already in all channels')
    expect(addButton().hasAttribute('disabled')).toBe(true)
    fireEvent.click(addButton())
    await flush()

    expect(paramsOf(fake, setBotSettings)).toEqual([])
  })

  test('a bot whose settings already list this channel sends nothing', async () => {
    answerSettings({cmds: true, convs: [convID], mentions: false})
    renderBot()
    await flush()

    fireEvent.click(addButton())
    await flush()

    expect(paramsOf(fake, setBotSettings)).toEqual([])
  })

  test('a failed settings edit is only logged: no participant refresh, and a retry resends the same settings', async () => {
    answerSettings({cmds: true, convs: ['other-conv'], mentions: false})
    fake.answer(setBotSettings, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'not allowed'))
    const logInfo = jest.spyOn(logger, 'info').mockImplementation(() => {})
    const {container} = renderBot()
    await flush()

    fireEvent.click(addButton())
    await flush()

    expect(logInfo).toHaveBeenCalledWith(`AddToChannel: failed to edit bot settings: ERROR CODE ${T.RPCGen.StatusCode.scgeneric} - not allowed in method ${setBotSettings}`
    )
    expect(paramsOf(fake, previewConversation)).toEqual([])
    expect(container.textContent).not.toContain('not allowed')

    fireEvent.click(addButton())
    await flush()

    const sets = paramsOf(fake, setBotSettings)
    expect(sets).toHaveLength(2)
    expect(sets[1]).toEqual(sets[0])
  })

  test('a failed participant refresh after a successful add is swallowed silently', async () => {
    answerSettings({cmds: true, convs: ['other-conv'], mentions: false})
    fake.answer(setBotSettings, () => null)
    fake.answer(previewConversation, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'preview failed'))
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
    fake.answer('keybase.1.featuredBot.featuredBots', () => ({bots: [], isLastPage: true}))
    fake.answer(getTeamMembers, () => [])
  })

  const setConversation = (meta: T.Chat.ConversationMeta, participants?: T.Chat.ParticipantInfo) => {
    metasReceived([meta])
    if (participants) {
      participantInfoReceived(convID, participants)
    }
  }

  const adhocMeta = (): T.Chat.ConversationMeta => ({
    ...makeConversationMeta(),
    conversationIDKey: convID,
    teamType: 'adhoc',
    trustedState: 'trusted',
  })
  const bigTeamMeta = (): T.Chat.ConversationMeta => ({
    ...makeConversationMeta(),
    channelname: 'random',
    conversationIDKey: convID,
    teamID: 'team-1',
    trustedState: 'trusted',
    teamType: 'big',
    teamname: 'acme',
  })

  test('an adhoc conversation with participants but no names asks for a preview to repair them', async () => {
    setConversation(adhocMeta(), {all: ['testuser', 'testbot'], contactName: new Map(), name: []})
    fake.answer(previewConversation, () => previewWith([uiParticipant('testuser', true), uiParticipant('testbot')]))

    renderBotTab()
    await flush()

    expect(paramsOf(fake, previewConversation)).toEqual([{convID: convIDOf(convID)}])
    expect(storedParticipants()).toEqual({
      all: ['testuser', 'testbot'],
      contactName: new Map(),
      name: ['testuser'],
    })
  })

  test('the adhoc repair runs once per conversation, not on every render', async () => {
    setConversation(adhocMeta(), {all: ['testuser', 'testbot'], contactName: new Map(), name: []})
    fake.answer(previewConversation, () => previewWith([]))

    const {rerender} = renderBotTab()
    await flush()
    act(() => {
      participantInfoReceived(convID, {all: ['testuser', 'testbot', 'otherbot'], contactName: new Map(), name: []})
    })
    rerender(<BotTab commonSections={[]} conversationIDKey={convID} />)
    await flush()

    expect(paramsOf(fake, previewConversation)).toHaveLength(1)
  })

  test.each([
    ['names are already known', {all: ['testuser', 'testbot'], contactName: new Map(), name: ['testuser']}],
    ['there are no participants yet', {all: [], contactName: new Map(), name: []}],
  ])('no adhoc repair when %s', async (_label, participants: T.Chat.ParticipantInfo) => {
    setConversation(adhocMeta(), participants)

    renderBotTab()
    await flush()

    expect(paramsOf(fake, previewConversation)).toEqual([])
  })

  test('a team conversation never runs the adhoc repair', async () => {
    setConversation(bigTeamMeta(), {all: ['testuser', 'testbot'], contactName: new Map(), name: []})

    renderBotTab()
    await flush()

    expect(paramsOf(fake, previewConversation)).toEqual([])
  })

  test('a failed adhoc repair is swallowed silently', async () => {
    setConversation(adhocMeta(), {all: ['testuser', 'testbot'], contactName: new Map(), name: []})
    fake.answer(previewConversation, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'preview failed'))
    const logInfo = jest.spyOn(logger, 'info')
    const logError = jest.spyOn(logger, 'error')

    renderBotTab()
    await flush()

    expect(paramsOf(fake, previewConversation)).toHaveLength(1)
    // the participants stay as they were
    expect(storedParticipants()).toEqual({all: ['testuser', 'testbot'], contactName: new Map(), name: []})
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
    setConversation(bigTeamMeta())
    fake.answer(previewConversation, () => previewWith([uiParticipant('testuser', true), uiParticipant('testbot')]))

    renderBotTab()
    await flush()
    expect(paramsOf(fake, previewConversation)).toEqual([])

    await runMutation(key)

    expect(paramsOf(fake, previewConversation)).toHaveLength(1)
    expect(paramsOf(fake, previewConversation)).toEqual([{convID: convIDOf(convID)}])
    expect(storedParticipants()?.all).toEqual(['testuser', 'testbot'])
    // the members load on mount, then reload once the mutation lands
    expect(paramsOf(fake, getTeamMembers)).toEqual([{id: 'team-1'}, {id: 'team-1'}])
  })

  test('when a bot mutation finishes in an adhoc conversation, only the participants are refreshed', async () => {
    setConversation(adhocMeta(), {all: ['testuser', 'testbot'], contactName: new Map(), name: ['testuser']})
    fake.answer(previewConversation, () => previewWith([]))

    renderBotTab()
    await flush()
    await runMutation(C.waitingKeyChatBotAdd)

    expect(paramsOf(fake, previewConversation)).toHaveLength(1)
    expect(paramsOf(fake, getTeamMembers)).toEqual([])
  })

  test('a bot mutation that ended in an error refreshes nothing', async () => {
    setConversation(bigTeamMeta())

    renderBotTab()
    await flush()
    await runMutation(C.waitingKeyChatBotAdd, new Error('add failed'))

    expect(paramsOf(fake, previewConversation)).toEqual([])
    // only the load on mount
    expect(paramsOf(fake, getTeamMembers)).toHaveLength(1)
  })

  test('a failed refresh after a bot mutation is swallowed silently', async () => {
    setConversation(bigTeamMeta())
    fake.answer(previewConversation, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'preview failed'))
    const logInfo = jest.spyOn(logger, 'info')
    const logError = jest.spyOn(logger, 'error')

    renderBotTab()
    await flush()
    await runMutation(C.waitingKeyChatBotAdd)

    expect(storedParticipants()).toBeUndefined()
    expect(logInfo).not.toHaveBeenCalled()
    expect(logError).not.toHaveBeenCalled()
    expect(paramsOf(fake, getTeamMembers)).toHaveLength(2)
  })
})
