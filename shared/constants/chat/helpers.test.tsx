/// <reference types="jest" />
import * as T from '@/constants/types'
import {makeMessageText} from './message'
import {
  clampImageSize,
  getBotsAndParticipants,
  getMessageKey,
  getTeamMentionName,
  isAssertion,
  isBigTeam,
  zoomImage,
} from './helpers'
import {makeConversationMeta} from './meta'

// Team convs get an empty `name`: the service only sets inConvName for users named in
// the conv's TLF name, and a team channel's TLF name is the team.
const participantInfo: T.Chat.ParticipantInfo = {
  all: ['alice', 'helperbot', 'bob'],
  contactName: new Map(),
  name: [],
}

const adhocParticipantInfo: T.Chat.ParticipantInfo = {
  all: ['alice', 'helperbot', 'bob'],
  contactName: new Map(),
  name: ['alice', 'bob'],
}

const member = (username: string, type: T.Teams.TeamRoleType): T.Teams.MemberInfo => ({
  fullName: '',
  needsPUK: false,
  status: 'active',
  type,
  username,
})

const teamMeta = {
  ...makeConversationMeta(),
  channelname: 'random',
  teamType: 'small' as const,
}

test('getBotsAndParticipants lists team channel participants before team roles load', () => {
  expect(getBotsAndParticipants(teamMeta, participantInfo, new Map()).participants).toEqual([
    'alice',
    'helperbot',
    'bob',
  ])
})

test('getBotsAndParticipants splits adhoc bots out by conv name membership', () => {
  const adhocMeta = {...makeConversationMeta(), teamType: 'adhoc' as const}
  expect(getBotsAndParticipants(adhocMeta, adhocParticipantInfo)).toEqual({
    bots: ['helperbot'],
    participants: ['alice', 'bob'],
  })
})

test('getBotsAndParticipants keeps using role data after team members load', () => {
  const members = new Map<string, T.Teams.MemberInfo>([
    ['alice', member('alice', 'writer')],
    ['helperbot', member('helperbot', 'restrictedbot')],
    ['bob', member('bob', 'reader')],
  ])

  expect(getBotsAndParticipants(teamMeta, participantInfo, members)).toEqual({
    bots: ['helperbot'],
    participants: ['alice', 'bob'],
  })
})

test('getMessageKey is conversation + ordinal', () => {
  const message = makeMessageText({
    conversationIDKey: T.Chat.stringToConversationIDKey('conv1'),
    ordinal: T.Chat.numberToOrdinal(4.001),
  })
  expect(getMessageKey(message)).toBe('conv1:4.001')
})

test('getTeamMentionName only appends a channel when there is one', () => {
  expect(getTeamMentionName('acme', '')).toBe('acme')
  expect(getTeamMentionName('acme', 'general')).toBe('acme#general')
})

test('isAssertion looks for a service separator', () => {
  expect(isAssertion('testuser')).toBe(false)
  expect(isAssertion('testuser@twitter')).toBe(true)
})

describe('clampImageSize', () => {
  test('leaves images that already fit alone', () => {
    expect(clampImageSize(100, 50, 200, 200)).toEqual({height: 50, width: 100})
  })

  test('clamps by width and keeps the aspect ratio', () => {
    expect(clampImageSize(400, 200, 200, 400)).toEqual({height: 100, width: 200})
  })

  test('clamps by height and keeps the aspect ratio', () => {
    expect(clampImageSize(200, 400, 400, 200)).toEqual({height: 200, width: 100})
  })

  test('clamps both dimensions, height wins last', () => {
    expect(clampImageSize(400, 800, 200, 200)).toEqual({height: 200, width: 100})
  })
})

describe('zoomImage', () => {
  test('falls back to a square when there are no dimensions', () => {
    expect(zoomImage(0, 100, 80)).toEqual({
      dims: {height: 80, width: 80},
      margins: {marginBottom: 0, marginLeft: 0, marginRight: 0, marginTop: 0},
    })
  })

  test('tall images fill the width and bleed vertically', () => {
    const {dims, margins} = zoomImage(50, 100, 80)
    expect(dims).toEqual({height: 160, width: 80})
    expect(margins).toEqual({marginBottom: -40, marginLeft: -0, marginRight: -0, marginTop: -40})
  })

  test('wide images fill the height and bleed horizontally', () => {
    const {dims, margins} = zoomImage(100, 50, 80)
    expect(dims).toEqual({height: 80, width: 160})
    expect(margins).toEqual({marginBottom: -0, marginLeft: -40, marginRight: -40, marginTop: -0})
  })
})

describe('isBigTeam', () => {
  const label = (id: string): T.RPCChat.UIInboxBigTeamRow => ({
    label: {id: id, name: id},
    state: T.RPCChat.UIInboxBigTeamRowTyp.label,
  })

  test('false without a layout', () => {
    expect(isBigTeam(undefined, 'teamID')).toBe(false)
  })

  test('true only when the team has a label row', () => {
    const layout = {bigTeams: [label('teamID')], smallTeams: [], totalSmallTeams: 0}
    expect(isBigTeam(layout, 'teamID')).toBe(true)
    expect(isBigTeam(layout, 'otherTeamID')).toBe(false)
  })
})
