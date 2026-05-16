/// <reference types="jest" />
import {buildInboxRows} from './rows'
import * as T from '@/constants/types'

const smallTeamRow = (convID: string, name = convID): T.RPCChat.UIInboxSmallTeamRow => ({
  convID: convID as T.RPCChat.ConvIDStr,
  draft: null,
  isMuted: false,
  isTeam: true,
  lastSendTime: 0,
  name,
  snippet: null,
  snippetDecoration: T.RPCChat.SnippetDecoration.none,
  time: 0,
})

const bigTeamLabelRow = (name: string, id: string): T.RPCChat.UIInboxBigTeamRow => ({
  label: {
    id: id as T.RPCChat.TLFIDStr,
    name,
  },
  state: T.RPCChat.UIInboxBigTeamRowTyp.label,
})

const bigTeamChannelRow = (convID: string, teamname: string, channelname: string): T.RPCChat.UIInboxBigTeamRow => ({
  channel: {
    channelname,
    convID: convID as T.RPCChat.ConvIDStr,
    draft: null,
    isMuted: false,
    teamname,
  },
  state: T.RPCChat.UIInboxBigTeamRowTyp.channel,
})

test('buildInboxRows returns empty state when layout is missing', () => {
  expect(buildInboxRows(undefined, 5, false)).toEqual({
    allowShowFloatingButton: false,
    rows: [],
    smallTeamsExpanded: false,
  })
})

test('buildInboxRows shows all small teams and a trailing team builder when there are no big teams', () => {
  const result = buildInboxRows(
    {
      bigTeams: [],
      smallTeams: [smallTeamRow('small1'), smallTeamRow('small2')],
      totalSmallTeams: 2,
    },
    1,
    false
  )

  expect(result).toEqual({
    allowShowFloatingButton: false,
    rows: [
      {conversationIDKey: T.Chat.stringToConversationIDKey('small1'), type: 'small'},
      {conversationIDKey: T.Chat.stringToConversationIDKey('small2'), type: 'small'},
      {type: 'teamBuilder'},
    ],
    smallTeamsExpanded: true,
  })
})

test('buildInboxRows collapses mixed layouts behind a divider and enables the floating button', () => {
  const result = buildInboxRows(
    {
      bigTeams: [bigTeamLabelRow('acme', 'team1'), bigTeamChannelRow('big1', 'acme', 'general')],
      smallTeams: [smallTeamRow('small1'), smallTeamRow('small2'), smallTeamRow('small3')],
      totalSmallTeams: 3,
    },
    2,
    false
  )

  expect(result).toEqual({
    allowShowFloatingButton: true,
    rows: [
      {conversationIDKey: T.Chat.stringToConversationIDKey('small1'), type: 'small'},
      {conversationIDKey: T.Chat.stringToConversationIDKey('small2'), type: 'small'},
      {hiddenCount: 1, showButton: true, type: 'divider'},
      {teamID: 'team1', teamname: 'acme', type: 'bigHeader'},
      {conversationIDKey: T.Chat.stringToConversationIDKey('big1'), type: 'big'},
      {type: 'teamBuilder'},
    ],
    smallTeamsExpanded: false,
  })
})

test('buildInboxRows keeps the big-teams divider when mixed layouts are manually expanded', () => {
  const result = buildInboxRows(
    {
      bigTeams: [bigTeamChannelRow('big1', 'acme', 'general')],
      smallTeams: [smallTeamRow('small1'), smallTeamRow('small2')],
      totalSmallTeams: 2,
    },
    1,
    true
  )

  expect(result).toEqual({
    allowShowFloatingButton: true,
    rows: [
      {conversationIDKey: T.Chat.stringToConversationIDKey('small1'), type: 'small'},
      {conversationIDKey: T.Chat.stringToConversationIDKey('small2'), type: 'small'},
      {hiddenCount: 0, showButton: false, type: 'divider'},
      {conversationIDKey: T.Chat.stringToConversationIDKey('big1'), type: 'big'},
      {type: 'teamBuilder'},
    ],
    smallTeamsExpanded: true,
  })
})

test('buildInboxRows preserves a load-more divider when the server only sent part of the small teams', () => {
  const result = buildInboxRows(
    {
      bigTeams: [],
      smallTeams: [smallTeamRow('small1'), smallTeamRow('small2')],
      totalSmallTeams: 5,
    },
    1,
    false
  )

  expect(result).toEqual({
    allowShowFloatingButton: false,
    rows: [
      {conversationIDKey: T.Chat.stringToConversationIDKey('small1'), type: 'small'},
      {conversationIDKey: T.Chat.stringToConversationIDKey('small2'), type: 'small'},
      {hiddenCount: 3, showButton: true, type: 'divider'},
      {type: 'teamBuilder'},
    ],
    smallTeamsExpanded: true,
  })
})
