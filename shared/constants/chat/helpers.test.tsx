/// <reference types="jest" />
import {getBotsAndParticipants} from './helpers'
import {makeConversationMeta} from './meta'
import type * as T from '@/constants/types'

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
