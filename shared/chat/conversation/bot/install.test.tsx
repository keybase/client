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
      classNames: () => '',
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
    ModalScreen: (p: {children?: React.ReactNode; footer?: React.ReactNode}) =>
      R.createElement('div', null, p.children, p.footer),
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
jest.mock('./channel-picker', () => ({__esModule: true, default: () => null}))

import {act, cleanup, fireEvent, render, renderHook, screen} from '@testing-library/react'
import * as C from '@/constants'
import * as Meta from '@/constants/chat/meta'
import * as NavTree from '@/constants/nav-tree'
import * as T from '@/constants/types'
import logger from '@/logger'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {LoadedTeamsListProvider} from '@/teams/use-teams-list'
import {metasReceived} from '@/chat/inbox/metadata'
import {useWaitingState} from '@/stores/waiting'
import {useInboxMetadataState} from '@/chat/inbox/metadata'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {flush} from '@/test/flush'
import {navigationWrapper, type NavigationRecorder} from '@/test/navigation'
import {useBotSettings} from './settings'
import InstallBotPopup, {refreshBotMembership, useBotTeamRole} from './install'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const otherConvID = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))

const getTeamRole = 'chat.1.local.getTeamRoleInConversation'
const getBotSettings = 'chat.1.local.getBotMemberSettings'
const previewConversation = 'chat.1.local.previewConversationByIDLocal'
const addBotMember = 'chat.1.local.addBotMember'
const setBotSettings = 'chat.1.local.setBotMemberSettings'
const listPublicBotCommands = 'chat.1.local.listPublicBotCommandsLocal'
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

test('useBotTeamRole refreshes role for the selected conversation and ignores stale results', async () => {
  const held = fake.hold(getTeamRole)

  const {rerender, result} = renderHook(
    ({botUsername, id}) => useBotTeamRole(id, botUsername),
    {initialProps: {botUsername: 'helperbot', id: convID}}
  )
  rerender({botUsername: 'otherbot', id: convID})
  await flush()
  expect(paramsOf(fake, getTeamRole)).toEqual([
    {convID: convIDOf(convID), username: 'helperbot'},
    {convID: convIDOf(convID), username: 'otherbot'},
  ])

  held[0]!.reply(T.RPCGen.TeamRole.bot)
  await flush()

  expect(result.current).toBeUndefined()

  held[1]!.reply(T.RPCGen.TeamRole.restrictedbot)
  await flush()

  expect(result.current).toBe('restrictedbot')
})

test('useBotSettings refreshes only when enabled and hides stale conversation data', async () => {
  const settings = {cmds: true, convs: [convID], mentions: false}
  fake.answer(getBotSettings, () => settings)

  const {rerender, result} = renderHook(
    ({enabled, id}) => useBotSettings(id, 'helperbot', enabled),
    {initialProps: {enabled: false, id: convID as T.Chat.ConversationIDKey | undefined}}
  )

  await flush()

  expect(paramsOf(fake, getBotSettings)).toEqual([])
  expect(result.current.settings).toBeUndefined()

  rerender({enabled: true, id: convID})
  await flush()

  expect(paramsOf(fake, getBotSettings)).toEqual([{convID: convIDOf(convID), username: 'helperbot'}])
  expect(result.current.settings).toEqual(settings)

  rerender({enabled: true, id: otherConvID})

  expect(result.current.settings).toBeUndefined()

  await flush()

  expect(paramsOf(fake, getBotSettings).at(-1)).toEqual({convID: convIDOf(otherConvID), username: 'helperbot'})
  expect(result.current.settings).toEqual(settings)
})

test('useBotTeamRole logs a failed getTeamRoleInConversation and reports no role', async () => {
  const info = jest.spyOn(logger, 'info').mockImplementation(() => {})
  fake.answer(getTeamRole, () => fakeError(6, 'no such conv'))

  const {result} = renderHook(() => useBotTeamRole(convID, 'helperbot'))
  await flush()

  expect(result.current).toBeUndefined()
  expect(info).toHaveBeenCalledWith('useBotTeamRole: failed to refresh bot team role: ERROR CODE 6 - no such conv in method chat.1.local.getTeamRoleInConversation')
})

test('useBotTeamRole does not call the service without a conversation', () => {
  const {result} = renderHook(() => useBotTeamRole(undefined, 'helperbot'))
  expect(fake.calls).toEqual([])
  expect(result.current).toBeUndefined()
})

const settle = flush

const previewResult = (participants: Array<string>) => ({
  conv: {
    participants: participants.map(assertion => ({
      assertion,
      inConvName: true,
      type: T.RPCChat.UIParticipantType.user,
    })),
  } as unknown as T.RPCChat.InboxUIItem,
})

describe('refreshBotMembership', () => {
  test('previews the conversation and stores its participants', async () => {
    fake.answer(previewConversation, () => previewResult(['testuser', 'helperbot']))
    await refreshBotMembership(convID)

    expect(paramsOf(fake, previewConversation)).toEqual([{convID: convIDOf(convID)}])
    expect(useInboxMetadataState.getState().participants.get(convID)).toEqual({
      all: ['testuser', 'helperbot'],
      contactName: new Map(),
      name: ['testuser', 'helperbot'],
    })
  })

  test('a failed preview resolves and stores nothing', async () => {
    fake.answer(previewConversation, () => fakeError(2, 'offline'))
    await refreshBotMembership(convID)

    expect(paramsOf(fake, previewConversation)).toEqual([{convID: convIDOf(convID)}])
    expect(useInboxMetadataState.getState().participants.get(convID)).toBeUndefined()
  })

  test('skips the preview for a missing or invalid conversation', async () => {
    await refreshBotMembership(undefined)
    await refreshBotMembership(T.Chat.noConversationIDKey)
    expect(paramsOf(fake, previewConversation)).toEqual([])
  })
})

describe('InstallBotPopup service calls', () => {
  const teamID = 'team1'
  const chanA = T.Chat.conversationIDToKey(new Uint8Array([9, 9]))
  const goneChan = T.Chat.conversationIDToKey(new Uint8Array([8, 8]))
  let nav: NavigationRecorder
  let info: jest.SpyInstance

  const setMeta = (botCommands?: T.RPCChat.ConversationCommandGroups) => {
    metasReceived([
      {
        ...Meta.makeConversationMeta(),
        // a later inbox version, as the service sends when the commands change
        ...(botCommands ? {botCommands, inboxVersion: 2} : {inboxVersion: 1}),
        conversationIDKey: convID,
        teamID,
        teamname: 'acme',
        teamType: 'big',
        trustedState: 'trusted',
      },
    ])
  }

  const channelItem = (conversationIDKey: T.Chat.ConversationIDKey, channel: string) =>
    ({
      botAliases: {},
      botCommands: {typ: T.RPCChat.ConversationCommandGroupsTyp.none},
      channel,
      convID: T.Chat.conversationIDKeyToString(conversationIDKey),
      headline: '',
      maxMsgID: 1,
      maxVisibleMsgID: 1,
      memberStatus: T.RPCChat.ConversationMemberStatus.active,
      membersType: T.RPCChat.ConversationMembersType.team,
      name: 'acme',
      participants: [],
      readMsgID: 1,
      status: T.RPCChat.ConversationStatus.unfiled,
      teamType: T.RPCChat.TeamType.complex,
      time: 1,
      tlfID: teamID,
      visibility: T.RPCGen.TLFVisibility.private,
    }) as unknown as T.RPCChat.InboxUIItem

  // The engine throttles waiting increments (500ms), so a press soon after the popup's own loads
  // reaches the store late; waiting this out lets a test read the in-flight count.
  const waitOutWaitingThrottle = async () => {
    await act(async () => new Promise(resolve => setTimeout(resolve, 510)))
  }

  const answerRole = (role: T.RPCGen.TeamRole) => fake.answer(getTeamRole, () => role)

  const answerPublicCommands = (names: Array<string>) =>
    fake.answer(listPublicBotCommands, () => ({commands: names.map(name => ({description: '', name, usage: ''}))}))

  const answerPreview = () => fake.answer(previewConversation, () => previewResult(['testuser', 'helperbot']))

  // as the chat opens it: a root-stack modal over the chat tab
  const renderPopup = async (botUsername = 'helperbot') => {
    const n = navigationWrapper({params: {botUsername, conversationIDKey: convID}, route: 'chatInstallBot'})
    nav = n
    const r = render(
      <LoadedTeamsListProvider>
        <InstallBotPopup botUsername={botUsername} conversationIDKey={convID} />
      </LoadedTeamsListProvider>,
      {wrapper: n.wrapper}
    )
    await settle()
    return r
  }

  const modals = () => NavTree.modalStack(nav.getRootState()).map(r => r.name)

  // the user closes the popup and opens another modal
  const leaveForNewChat = async () => {
    act(() => {
      C.Router2.clearModals()
      C.Router2.navigateAppend({name: 'chatNewChat', params: {namespace: 'chat', title: 'New chat'}})
    })
    await settle()
    expect(modals()).toEqual(['chatNewChat'])
  }

  // the user closes the popup and opens the same bot's popup again
  const reopenSameBot = async () => {
    act(() => {
      C.Router2.clearModals()
      C.Router2.navigateAppend({name: 'chatInstallBot', params: {botUsername: 'helperbot', conversationIDKey: convID}})
    })
    await settle()
    expect(modals()).toEqual(['chatInstallBot'])
  }

  const click = async (text: string) => {
    fireEvent.click(screen.getByText(text))
    await settle()
  }

  beforeEach(() => {
    useConfigState.setState({loggedIn: true})
    useCurrentUserState.getState().dispatch.setBootstrap({
      deviceID: 'device-id',
      deviceName: 'testuser-mac',
      uid: 'uid',
      username: 'testuser',
    })
    setMeta()
    // you are an admin of the team, so you may manage its bots
    fake.answer('keybase.1.teams.getTeamRoleMap', () => ({
      teams: {[teamID]: {implicitRole: T.RPCGen.TeamRole.none, role: T.RPCGen.TeamRole.admin}},
      version: 1,
    }))
    fake.answer('keybase.1.teams.teamListUnverified', () => ({
      teams: [
        {
          fqName: 'acme',
          isMemberShowcased: false,
          isOpenTeam: false,
          memberCount: 2,
          role: T.RPCGen.TeamRole.admin,
          teamID,
          username: 'testuser',
        },
      ],
    }))
    fake.answer('keybase.1.teams.getAnnotatedTeam', () => ({
      invites: [],
      joinRequests: [],
      members: [],
      name: 'acme',
      settings: {joinAs: T.RPCGen.TeamRole.reader, open: false},
      showcase: {anyMemberShowcase: false, description: '', isShowcased: false},
      tarsDisabled: false,
      teamID,
      transitiveSubteamsUnverified: {entries: []},
    }))
    fake.answer('chat.1.local.getTLFConversationsLocal', () => ({
      convs: [channelItem(chanA, 'random')],
      offline: false,
    }))
    fake.answer('keybase.1.featuredBot.search', () => ({bots: []}))
    info = jest.spyOn(logger, 'info').mockImplementation(() => {})
  })

  describe('install (addBotMember)', () => {
    test('a restricted install sends the chosen read settings as restrictedbot, then refreshes and closes', async () => {
      answerRole(T.RPCGen.TeamRole.none)
      answerPublicCommands([])
      const held = fake.hold(addBotMember)
      answerPreview()

      await renderPopup()
      // not in the team yet, so there are no member settings to load
      expect(paramsOf(fake, getBotSettings)).toEqual([])
      await click('Review')
      await waitOutWaitingThrottle()
      await click('Install')

      expect(C.waitingKeyChatBotAdd).toBe('chat:botAdd')
      expect(useWaitingState.getState().counts.get(C.waitingKeyChatBotAdd)).toBe(1)
      expect(paramsOf(fake, addBotMember)).toEqual([
        {
          botSettings: {cmds: true, convs: [], mentions: true},
          convID: convIDOf(convID),
          role: T.RPCGen.TeamRole.restrictedbot,
          username: 'helperbot',
        },
      ])
      held[0]!.reply(null)
      await settle()

      expect(paramsOf(fake, previewConversation)).toEqual([{convID: convIDOf(convID)}])
      expect(useInboxMetadataState.getState().participants.get(convID)?.all).toEqual(['testuser', 'helperbot'])
      expect(modals()).toEqual([])
      expect(info).not.toHaveBeenCalled()
    })

    test('an unrestricted install sends no bot settings', async () => {
      answerRole(T.RPCGen.TeamRole.none)
      answerPublicCommands([])
      const held = fake.hold(addBotMember)
      answerPreview()

      await renderPopup()
      await click('Unrestricted bot')
      await click('Review')
      await click('Install')
      held[0]!.reply(null)
      await settle()

      // the adapter's undefined settings cross the wire as null
      expect(paramsOf(fake, addBotMember)).toEqual([
        {botSettings: null, convID: convIDOf(convID), role: T.RPCGen.TeamRole.bot, username: 'helperbot'},
      ])
      expect(modals()).toEqual([])
    })

    // The engine throttles a waiting "on" (500ms) but flushes an "off" at once, so an install this
    // quick is never seen as waiting; the close has to follow the call itself.
    test('an install that settles inside the waiting throttle window still refreshes and closes', async () => {
      answerRole(T.RPCGen.TeamRole.none)
      answerPublicCommands([])
      fake.answer(addBotMember, () => null)
      answerPreview()

      await renderPopup()
      await click('Review')
      await click('Install')

      expect(paramsOf(fake, addBotMember)).toHaveLength(1)
      expect(modals()).toEqual([])
    })

    test('a popup the user left while the install ran leaves the modal they opened since alone', async () => {
      answerRole(T.RPCGen.TeamRole.none)
      answerPublicCommands([])
      const held = fake.hold(addBotMember)
      answerPreview()

      await renderPopup()
      await click('Review')
      await click('Install')
      await leaveForNewChat()
      held[0]!.reply(null)
      await settle()

      expect(paramsOf(fake, previewConversation)).toEqual([{convID: convIDOf(convID)}])
      expect(modals()).toEqual(['chatNewChat'])
    })

    test('a popup reopened for the same bot while the install ran stays open', async () => {
      answerRole(T.RPCGen.TeamRole.none)
      answerPublicCommands([])
      const held = fake.hold(addBotMember)
      answerPreview()

      await renderPopup()
      await click('Review')
      await click('Install')
      await reopenSameBot()
      held[0]!.reply(null)
      await settle()

      expect(paramsOf(fake, previewConversation)).toEqual([{convID: convIDOf(convID)}])
      expect(modals()).toEqual(['chatInstallBot'])
    })

    test('a failed install is logged, shows the error line, and neither refreshes nor closes', async () => {
      answerRole(T.RPCGen.TeamRole.none)
      answerPublicCommands([])
      fake.answer(addBotMember, () => fakeError(7, 'team is full'))

      await renderPopup()
      await click('Review')
      await click('Install')

      expect(info).toHaveBeenCalledWith(
        'addBotMember: failed to add bot member: ERROR CODE 7 - team is full in method chat.1.local.addBotMember'
      )
      expect(screen.getByText('Something went wrong! Please try again, or send')).toBeTruthy()
      expect(paramsOf(fake, previewConversation)).toEqual([])
      expect(modals()).toEqual(['chatInstallBot'])
    })
  })

  describe('edit (setBotSettings)', () => {
    const renderInstalled = async (settings: T.RPCGen.TeamBotSettings) => {
      answerRole(T.RPCGen.TeamRole.restrictedbot)
      answerPublicCommands([])
      fake.answer(getBotSettings, () => settings)
      await renderPopup()
      expect(paramsOf(fake, getBotSettings)).toContainEqual({convID: convIDOf(convID), username: 'helperbot'})
    }

    const save = async () => {
      const held = fake.hold(setBotSettings)
      await click('Edit settings')
      await waitOutWaitingThrottle()
      await click('Save')
      expect(useWaitingState.getState().counts.get(C.waitingKeyChatBotAdd)).toBe(1)
      held[0]!.reply(null)
      await settle()
    }

    test('saving sends the edited settings with the add waiting key, then refreshes and closes', async () => {
      answerPreview()

      await renderInstalled({cmds: true, convs: [chanA], mentions: false})
      await save()

      expect(paramsOf(fake, setBotSettings)).toEqual([
        {
          botSettings: {cmds: true, convs: [chanA], mentions: false},
          convID: convIDOf(convID),
          username: 'helperbot',
        },
      ])
      expect(paramsOf(fake, previewConversation)).toEqual([{convID: convIDOf(convID)}])
      expect(modals()).toEqual([])
    })

    test('channels that no longer exist are dropped from what is saved', async () => {
      answerPreview()

      await renderInstalled({cmds: false, convs: [chanA, goneChan], mentions: true})
      await save()
      expect(paramsOf(fake, setBotSettings)[0]?.botSettings).toEqual({cmds: false, convs: [chanA], mentions: true})
    })

    test('an all-channels bot saves an empty convs list', async () => {
      answerPreview()

      await renderInstalled({cmds: true, convs: null, mentions: true})
      await save()
      expect(paramsOf(fake, setBotSettings)[0]?.botSettings).toEqual({cmds: true, convs: [], mentions: true})
    })

    test('a popup the user left while the save ran leaves the modal they opened since alone', async () => {
      answerPreview()

      await renderInstalled({cmds: true, convs: [chanA], mentions: false})
      const held = fake.hold(setBotSettings)
      await click('Edit settings')
      await click('Save')
      await leaveForNewChat()
      held[0]!.reply(null)
      await settle()

      expect(paramsOf(fake, previewConversation)).toEqual([{convID: convIDOf(convID)}])
      expect(modals()).toEqual(['chatNewChat'])
    })

    test('a popup reopened for the same bot while the save ran stays open', async () => {
      answerPreview()

      await renderInstalled({cmds: true, convs: [chanA], mentions: false})
      const held = fake.hold(setBotSettings)
      await click('Edit settings')
      await click('Save')
      await reopenSameBot()
      held[0]!.reply(null)
      await settle()

      expect(paramsOf(fake, previewConversation)).toEqual([{convID: convIDOf(convID)}])
      expect(modals()).toEqual(['chatInstallBot'])
    })

    test('a failed save is logged, shows the error line, and neither refreshes nor closes', async () => {
      fake.answer(setBotSettings, () => fakeError(8, 'denied'))

      await renderInstalled({cmds: true, convs: [chanA], mentions: false})
      await click('Edit settings')
      await click('Save')

      expect(info).toHaveBeenCalledWith(
        'addBotMember: failed to edit bot settings: ERROR CODE 8 - denied in method chat.1.local.setBotMemberSettings'
      )
      expect(screen.getByText('Something went wrong! Please try again, or send')).toBeTruthy()
      expect(paramsOf(fake, previewConversation)).toEqual([])
      expect(modals()).toEqual(['chatInstallBot'])
    })
  })

  describe('public bot commands (listPublicBotCommands)', () => {
    test('loads the commands by username (no waiting key) when the conversation has none', async () => {
      answerRole(T.RPCGen.TeamRole.none)
      answerPublicCommands(['help', 'weather'])

      await renderPopup()
      await click('Review')

      expect(paramsOf(fake, listPublicBotCommands)).toEqual([{username: 'helperbot'}])
      expect(screen.getByText('• !help')).toBeTruthy()
      expect(screen.getByText('• !weather')).toBeTruthy()
    })

    test('a failed load shows the load error, without a log', async () => {
      answerRole(T.RPCGen.TeamRole.none)
      fake.answer(listPublicBotCommands, () => fakeError(9, 'unknown bot'))

      await renderPopup()
      await click('Review')

      expect(screen.getByText('Error loading bot public commands.')).toBeTruthy()
      expect(info).not.toHaveBeenCalled()
    })

    test('a late result for the previous bot is dropped', async () => {
      answerRole(T.RPCGen.TeamRole.none)
      const held = fake.hold(listPublicBotCommands)
      const commandsReply = (names: Array<string>) => ({
        commands: names.map(name => ({description: '', name, usage: ''})),
      })

      const {rerender} = await renderPopup()
      await click('Review')
      rerender(
        <LoadedTeamsListProvider>
          <InstallBotPopup botUsername="otherbot" conversationIDKey={convID} />
        </LoadedTeamsListProvider>
      )
      await settle()
      expect(paramsOf(fake, listPublicBotCommands)).toEqual([{username: 'helperbot'}, {username: 'otherbot'}])

      held[1]!.reply(commandsReply(['other']))
      await settle()
      held[0]!.reply(commandsReply(['stale']))
      await settle()

      expect(screen.getByText('• !other')).toBeTruthy()
      expect(screen.queryByText('• !stale')).toBeNull()
    })

    test('skips the load when the conversation already lists the bot commands', async () => {
      answerRole(T.RPCGen.TeamRole.none)
      setMeta({
        custom: {
          commands: [
            {description: '', hasHelpText: false, name: 'fromMeta', usage: '', username: 'helperbot'},
            {description: '', hasHelpText: false, name: 'someoneElse', usage: '', username: 'otherbot'},
          ],
        },
        typ: T.RPCChat.ConversationCommandGroupsTyp.custom,
      })
      await renderPopup()
      await click('Review')

      expect(paramsOf(fake, listPublicBotCommands)).toEqual([])
      expect(screen.getByText('• !fromMeta')).toBeTruthy()
      expect(screen.queryByText('• !someoneElse')).toBeNull()
    })
  })
})
