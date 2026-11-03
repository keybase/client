/** @jest-environment jsdom */
/// <reference types="jest" />
import {expect, test, describe, beforeEach, afterEach} from '@jest/globals'
import type * as React from 'react'
import {act, cleanup, renderHook} from '@testing-library/react'
import * as T from '@/constants/types'
import {emptyTeamDetails, initialCanUserPerform, makeTeamMeta} from '@/constants/teams'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {LoadedTeamsListProvider} from '@/teams/use-teams-list'
import {resetAllStores} from '@/util/zustand'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {
  useBotSections,
  useChannelsSections,
  useEmojiSections,
  useInvitesSections,
  useMembersSections,
  useSubteamsSections,
  type Item,
  type Section,
} from './index'

const teamID = 'tid1' as T.Teams.TeamID

const ops = (over?: Partial<T.Teams.TeamOperations>): T.Teams.TeamOperations => ({
  ...initialCanUserPerform,
  ...over,
})

const member = (
  username: string,
  type: T.Teams.TeamRoleType = 'writer',
  status: T.Teams.MemberStatus = 'active'
): T.Teams.MemberInfo => ({fullName: '', needsPUK: false, status, type, username})

const details = (over?: Partial<T.Teams.TeamDetails>): T.Teams.TeamDetails => ({
  ...emptyTeamDetails,
  invites: new Set(),
  members: new Map(),
  requests: new Set(),
  subteams: new Set(),
  ...over,
})

const channel = (channelname: string): T.Teams.TeamChannelInfo =>
  ({
    channelname,
    conversationIDKey: channelname,
    description: '',
  })

const types = (sections: Array<Section>) =>
  sections.map(s => (s.data).map(d => d.type))

const flatTypes = (sections: Array<Section>) => types(sections).flat()

beforeEach(() => {
  useCurrentUserState.setState({username: 'testuser'})
})

describe('useMembersSections', () => {
  test('shows a loading row while the member list is still empty', () => {
    const {result} = renderHook(() =>
      useMembersSections(teamID, false, makeTeamMeta({memberCount: 3}), details(), ops())
    )
    expect(flatTypes(result.current)).toEqual(['members-loading'])
  })

  test('an explicit loading flag wins even when members are present', () => {
    const {result} = renderHook(() =>
      useMembersSections(
        teamID,
        true,
        makeTeamMeta({memberCount: 1}),
        details({members: new Map([['testuser', member('testuser')]])}),
        ops()
      )
    )
    expect(flatTypes(result.current)).toEqual(['members-loading'])
  })

  test('lists ordered members with the count in the title', () => {
    const members = new Map([
      ['zed', member('zed', 'reader')],
      ['boss', member('boss', 'owner')],
      ['abot', member('abot', 'bot')],
    ])
    const {result} = renderHook(() =>
      useMembersSections(teamID, false, makeTeamMeta({memberCount: 3}), details({members}), ops())
    )
    expect(result.current[0]?.title).toBe('Already in team (3)')
    const data = result.current[0]?.data as ReadonlyArray<Item>
    expect(
      data.map(d => (d.type === 'member-members' ? d.mi.username : d.type))
    ).toEqual(['boss', 'zed'])
  })

  test('a team of just you still shows the empty-members prompt', () => {
    const members = new Map([['testuser', member('testuser', 'owner')]])
    const {result} = renderHook(() =>
      useMembersSections(
        teamID,
        false,
        makeTeamMeta({memberCount: 1, role: 'owner'}),
        details({members}),
        ops()
      )
    )
    expect(flatTypes(result.current)).toEqual(['member-members', 'members-none'])
  })

  test('a one-member team you are not in does not show the prompt', () => {
    const members = new Map([['someone', member('someone')]])
    const {result} = renderHook(() =>
      useMembersSections(
        teamID,
        false,
        makeTeamMeta({memberCount: 1, role: 'none'}),
        details({members}),
        ops()
      )
    )
    expect(flatTypes(result.current)).toEqual(['member-members'])
  })
})

describe('useInvitesSections', () => {
  const noop = () => {}

  test('nothing pending means no sections at all', () => {
    const {result} = renderHook(() =>
      useInvitesSections(teamID, details(), false, noop as React.Dispatch<React.SetStateAction<boolean>>)
    )
    expect(result.current).toEqual([])
  })

  test('join requests and reset members share the requests section', () => {
    const d = details({
      members: new Map([
        ['reset-user', member('reset-user', 'writer', 'reset')],
        ['fine-user', member('fine-user')],
      ]),
      requests: new Set([{ctime: 5, fullName: 'Asker', username: 'asker'}]),
    })
    const {result} = renderHook(() =>
      useInvitesSections(teamID, d, false, noop as React.Dispatch<React.SetStateAction<boolean>>)
    )
    const data = result.current[0]?.data as ReadonlyArray<Item>
    expect(
      data.map(i => (i.type === 'invite-requests' ? [i.username, !!i.reset] : i.type))
    ).toEqual([
      ['asker', false],
      ['reset-user', true],
    ])
  })

  test('invitations are sorted and counted, collapsing empties the data but keeps the header', () => {
    const invites = new Set([
      {email: '', id: 'i2', name: '', phone: '', role: 'writer', username: 'zed'},
      {email: 'aaa@b.com', id: 'i1', name: '', phone: '', role: 'writer', username: ''},
    ]) as unknown as T.Teams.TeamDetails['invites']
    const d = details({invites})

    const open = renderHook(() =>
      useInvitesSections(teamID, d, false, noop as React.Dispatch<React.SetStateAction<boolean>>)
    )
    const section = open.result.current[0]!
    expect(section.title).toBe('Invitations (2)')
    expect(
      (section.data).map(i => (i.type === 'member-invites' ? i.ii.id : i.type))
    ).toEqual(['i1', 'i2'])

    const closed = renderHook(() =>
      useInvitesSections(teamID, d, true, noop as React.Dispatch<React.SetStateAction<boolean>>)
    )
    expect(closed.result.current[0]?.collapsed).toBe(true)
    expect(closed.result.current[0]?.data).toEqual([])
    expect(closed.result.current[0]?.title).toBe('Invitations (2)')
  })

  test('requests come before invitations', () => {
    const d = details({
      invites: new Set([
        {email: 'a@b.com', id: 'i1', name: '', phone: '', role: 'writer', username: ''},
      ]) as unknown as T.Teams.TeamDetails['invites'],
      requests: new Set([{ctime: 1, fullName: '', username: 'asker'}]),
    })
    const {result} = renderHook(() =>
      useInvitesSections(teamID, d, false, noop as React.Dispatch<React.SetStateAction<boolean>>)
    )
    expect(types(result.current)).toEqual([['invite-requests'], ['member-invites']])
  })
})

describe('useChannelsSections', () => {
  const many = new Map([
    ['zulu', channel('zulu')],
    ['general', channel('general')],
    ['alpha', channel('alpha')],
  ])

  test('loading with nothing yet shows the loading row', () => {
    const {result} = renderHook(() => useChannelsSections(teamID, ops(), new Map(), true))
    expect(flatTypes(result.current)).toEqual(['channel-loading'])
  })

  test('a team with only #general is treated as small', () => {
    const {result} = renderHook(() =>
      useChannelsSections(teamID, ops(), new Map([['general', channel('general')]]), false)
    )
    expect(flatTypes(result.current)).toEqual(['channel-empty'])
  })

  test('general is pinned first and the rest sort alphabetically', () => {
    const {result} = renderHook(() => useChannelsSections(teamID, ops(), many, false))
    const channelSection = result.current.find(s =>
      (s.data).some(d => d.type === 'channel-channels')
    )!
    expect(
      (channelSection.data).map(d =>
        d.type === 'channel-channels' ? d.c.channelname : d.type
      )
    ).toEqual(['general', 'alpha', 'zulu'])
  })

  test('only channel creators get the add row and the make-more-channels nudge', () => {
    const withPerm = renderHook(() =>
      useChannelsSections(teamID, ops({createChannel: true}), many, false)
    )
    expect(flatTypes(withPerm.result.current)).toEqual([
      'channel-add',
      'channel-channels',
      'channel-channels',
      'channel-channels',
      'channel-few',
    ])

    const withoutPerm = renderHook(() => useChannelsSections(teamID, ops(), many, false))
    expect(flatTypes(withoutPerm.result.current)).toEqual([
      'channel-channels',
      'channel-channels',
      'channel-channels',
      'channel-info',
    ])
  })

  test('past five channels the nudge becomes the plain info row', () => {
    const five = new Map(
      ['general', 'a', 'b', 'c', 'd'].map(n => [n, channel(n)] as const)
    )
    const {result} = renderHook(() =>
      useChannelsSections(teamID, ops({createChannel: true}), five, false)
    )
    expect(flatTypes(result.current).at(-1)).toBe('channel-info')
  })

  test('channels that arrived already win over a stale loading flag', () => {
    const {result} = renderHook(() => useChannelsSections(teamID, ops(), many, true))
    expect(flatTypes(result.current)).toEqual([
      'channel-channels',
      'channel-channels',
      'channel-channels',
      'channel-info',
    ])
  })
})

describe('useBotSections', () => {
  const bots = new Map([
    ['zbot', member('zbot', 'restrictedbot')],
    ['human', member('human', 'writer')],
    ['abot', member('abot', 'bot')],
  ])

  test('shows a loading row while the member list is still empty', () => {
    const {result} = renderHook(() =>
      useBotSections(teamID, false, makeTeamMeta({memberCount: 3}), details(), ops())
    )
    expect(flatTypes(result.current)).toEqual(['members-loading'])
  })

  test('an explicit loading flag wins even when members are present', () => {
    const {result} = renderHook(() =>
      useBotSections(
        teamID,
        true,
        makeTeamMeta({memberCount: 1}),
        details({members: new Map([['abot', member('abot', 'bot')]])}),
        ops()
      )
    )
    expect(flatTypes(result.current)).toEqual(['members-loading'])
  })

  test('only bots are listed, sorted by username', () => {
    const {result} = renderHook(() =>
      useBotSections(teamID, false, makeTeamMeta({memberCount: 3}), details({members: bots}), ops())
    )
    const data = result.current[0]?.data as ReadonlyArray<Item>
    expect(data.map(d => (d.type === 'member-members' ? d.mi.username : d.type))).toEqual(['abot', 'zbot'])
  })

  test('the add-bot row only appears when you can manage bots', () => {
    const withPerm = renderHook(() =>
      useBotSections(
        teamID,
        false,
        makeTeamMeta({memberCount: 3}),
        details({members: bots}),
        ops({manageBots: true})
      )
    )
    expect(flatTypes(withPerm.result.current)).toEqual(['member-members', 'member-members', 'add-bots'])

    const withoutPerm = renderHook(() =>
      useBotSections(teamID, false, makeTeamMeta({memberCount: 3}), details({members: bots}), ops())
    )
    expect(flatTypes(withoutPerm.result.current)).toEqual(['member-members', 'member-members'])
  })
})

// The team's emoji and its #general conversation come from the (fake) service, as in the app: the
// hook looks up #general, then asks for the emoji in it.
describe('useEmojiSections', () => {
  const convID = 'abcd'
  const findGeneral = 'chat.1.local.findGeneralConvFromTeamID'
  const userEmojis = 'chat.1.local.userEmojis'
  let fake: FakeEngine

  const general: T.RPCChat.InboxUIItem = {
    botCommands: {typ: T.RPCChat.ConversationCommandGroupsTyp.none},
    channel: 'general',
    commands: {typ: T.RPCChat.ConversationCommandGroupsTyp.none},
    convID,
    headline: '',
    headlineDecorated: '',
    isDefaultConv: true,
    isEmpty: false,
    isPublic: false,
    localVersion: 1,
    maxMsgID: 1,
    maxVisibleMsgID: 1,
    memberStatus: T.RPCChat.ConversationMemberStatus.active,
    membersType: T.RPCChat.ConversationMembersType.team,
    name: 'testteam',
    readMsgID: 1,
    snippet: '',
    snippetDecorated: '',
    snippetDecoration: T.RPCChat.SnippetDecoration.none,
    status: T.RPCChat.ConversationStatus.unfiled,
    teamType: T.RPCChat.TeamType.complex,
    time: 0,
    tlfID: teamID,
    topicType: T.RPCChat.TopicType.chat,
    version: 1,
    visibility: T.RPCGen.TLFVisibility.private,
  }
  const emoji = (alias: string): T.RPCChat.Emoji => ({
    alias,
    isAlias: false,
    isBig: false,
    isCrossTeam: false,
    isReacji: false,
    noAnimSource: {httpsrv: '', typ: T.RPCChat.EmojiLoadSourceTyp.httpsrv},
    remoteSource: {
      stockalias: {text: alias, time: 0, username: 'testuser'},
      typ: T.RPCChat.EmojiRemoteSourceTyp.stockalias,
    },
    source: {httpsrv: '', typ: T.RPCChat.EmojiLoadSourceTyp.httpsrv},
  })
  const answerEmoji = (...aliases: Array<string>) =>
    fake.answer(userEmojis, (): T.RPCChat.UserEmojiRes => ({
      emojis: {emojis: [{emojis: aliases.map(emoji), name: 'testteam'}]},
    }))
  const emojiCalls = () => fake.calls.filter(c => c.method === userEmojis)

  // Renders the sections and lets both loads land
  const renderLoaded = async (shouldActuallyLoad = true) => {
    const rendered = renderHook(() => useEmojiSections(teamID, shouldActuallyLoad))
    await flush()
    return rendered
  }

  beforeEach(() => {
    fake = installFakeEngine()
    fake.answer(findGeneral, () => general)
  })

  afterEach(() => {
    cleanup()
    resetAllStores()
  })

  test('with no custom emoji only the add row shows', async () => {
    answerEmoji()
    const {result} = await renderLoaded()
    expect(emojiCalls()).toHaveLength(1)
    expect(flatTypes(result.current)).toEqual(['emoji-add'])
  })

  test('the emoji rows appear once the load lands, asked for in the team\'s #general', async () => {
    const held = fake.hold(userEmojis)
    const {result} = renderHook(() => useEmojiSections(teamID, true))
    expect(flatTypes(result.current)).toEqual(['emoji-add'])
    await flush()
    expect(held).toHaveLength(1)
    expect((held[0]!.params as {convID: unknown}).convID).toEqual(T.Chat.keyToConversationID(T.Chat.stringToConversationIDKey(convID)))
    expect(flatTypes(result.current)).toEqual(['emoji-add'])

    held[0]!.reply({emojis: {emojis: [{emojis: [emoji('one')], name: 'testteam'}]}})
    await flush()
    expect(flatTypes(result.current)).toEqual(['emoji-add', 'emoji-header', 'emoji-item'])
  })

  test('custom emoji get a desktop-only header and one row each', async () => {
    answerEmoji('one', 'two')
    const {result} = await renderLoaded()
    expect(flatTypes(result.current)).toEqual(['emoji-add', 'emoji-header', 'emoji-item', 'emoji-item'])
  })

  test('mobile drops the header row', async () => {
    answerEmoji('one')
    global.isMobile = true
    try {
      const {result} = await renderLoaded()
      expect(flatTypes(result.current)).toEqual(['emoji-add', 'emoji-item'])
    } finally {
      global.isMobile = false
    }
  })

  test('the filter narrows the rows but keeps the header and add rows', async () => {
    answerEmoji('party', 'partyparrot', 'sad')
    const {result} = await renderLoaded()
    const addRow = result.current[0]!
    const renderAddRow = addRow.renderItem as (
      i: unknown
    ) => React.ReactElement<{setFilter: (f: string) => void}>
    const {setFilter} = renderAddRow({index: 0, item: {type: 'emoji-add'}}).props
    act(() => setFilter('PARTY'))

    const data = result.current.at(-1)?.data as ReadonlyArray<Item>
    expect(data.map(d => (d.type === 'emoji-item' ? d.e.alias : d.type))).toEqual(['party', 'partyparrot'])
    expect(types(result.current).length).toBe(3)
  })

  test('nothing loads until the tab actually asks for it', async () => {
    answerEmoji('one')
    const {result} = await renderLoaded(false)
    expect(emojiCalls()).toEqual([])
    expect(flatTypes(result.current)).toEqual(['emoji-add'])
  })
})

describe('useSubteamsSections', () => {
  const noop = () => {}
  const subteam = (id: string, fqName: string): T.RPCGen.AnnotatedMemberInfo => ({
    allowProfilePromote: false,
    eldestSeqno: 1,
    fqName,
    fullName: '',
    impTeamDisplayName: '',
    isImplicitTeam: false,
    isMemberShowcased: false,
    isOpenTeam: false,
    memberCount: 1,
    needsPUK: false,
    role: T.RPCGen.TeamRole.writer,
    status: T.RPCGen.TeamMemberStatus.active,
    teamID: id,
    userID: 'testuser-uid',
    username: 'testuser',
  })

  // The subteams' names come from the teams list the app's provider loads from the service
  const wrapper = ({children}: {children?: React.ReactNode}) => (
    <LoadedTeamsListProvider>{children}</LoadedTeamsListProvider>
  )
  type SubteamsArgs = Parameters<typeof useSubteamsSections>
  const renderSubteams = async (...args: SubteamsArgs) => {
    const rendered = renderHook(() => useSubteamsSections(...args), {wrapper})
    await flush()
    expect(fake.calls.map(c => c.method)).toContain('keybase.1.teams.teamListUnverified')
    return rendered
  }

  let fake: FakeEngine
  beforeEach(() => {
    useConfigState.getState().dispatch.setLoggedIn(true)
    fake = installFakeEngine()
    fake.answer('keybase.1.teams.teamListUnverified', () => ({
      teams: [subteam('sub-b', 'parent.beta'), subteam('sub-a', 'parent.alpha')],
    }))
    fake.answer('keybase.1.teams.getTeamRoleMap', () => ({teams: {}, version: 1}))
  })

  afterEach(() => {
    cleanup()
    resetAllStores()
  })

  test('with no subteams you get the empty row and no add row', async () => {
    const {result} = await renderSubteams(
        teamID,
        details(),
        ops({manageSubteams: true}),
        '',
        noop
      )
    expect(flatTypes(result.current)).toEqual(['subteam-none'])
  })

  test('subteams get an add row only when you can manage them', async () => {
    const d = details({subteams: new Set(['sub-b', 'sub-a'])})
    const canManage = await renderSubteams(
        teamID,
        d,
        ops({manageSubteams: true}),
        '',
        noop
      )
    expect(flatTypes(canManage.result.current)).toEqual([
      'subteam-add',
      'subteams',
      'subteams',
      'subteam-info',
    ])

    const cannot = await renderSubteams(teamID, d, ops(), '', noop)
    expect(flatTypes(cannot.result.current)).toEqual(['subteams', 'subteams', 'subteam-info'])
  })

  test('the filter matches on the team name, case insensitively', async () => {
    const d = details({subteams: new Set(['sub-b', 'sub-a'])})
    const {result} = await renderSubteams(
        teamID,
        d,
        ops(),
        '  ALPHA ',
        noop
      )
    const data = result.current[0]?.data as ReadonlyArray<Item>
    expect(data.map(i => (i.type === 'subteams' ? i.id : i.type))).toEqual(['sub-a'])
  })

  test('a filter matching nothing still keeps the info row, not the empty state', async () => {
    const d = details({subteams: new Set(['sub-b'])})
    const {result} = await renderSubteams(teamID, d, ops(), 'zzz', noop)
    expect(flatTypes(result.current)).toEqual(['subteam-info'])
  })
})
