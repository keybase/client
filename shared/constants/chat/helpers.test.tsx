/// <reference types="jest" />
import {getBotsAndParticipants} from '@/constants/chat/helpers'
import {makeConversationMeta} from '@/constants/chat/meta'
import type * as T from '@/constants/types'

const participantInfo: T.Chat.ParticipantInfo = {
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

test('getBotsAndParticipants excludes known bot participants before team roles load', () => {
  expect(getBotsAndParticipants(teamMeta, participantInfo, new Map()).participants).toEqual(['alice', 'bob'])
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
