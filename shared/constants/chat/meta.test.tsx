/// <reference types="jest" />
import * as T from '@/constants/types'
import {
  getEffectiveRetentionPolicy,
  inboxUIItemToConversationMeta,
  unverifiedInboxUIItemToConversationMeta,
} from './meta'

const commands = {typ: T.RPCChat.ConversationCommandGroupsTyp.none} as T.RPCChat.ConversationCommandGroups

const makeTrustedFixture = (
  overrides: Partial<T.RPCChat.InboxUIItem> = {}
): T.RPCChat.InboxUIItem => ({
  botAliases: {},
  botCommands: commands,
  channel: '',
  commands,
  convID: 'convIDTeam' as T.RPCChat.ConvIDStr,
  convRetention: undefined,
  draft: undefined,
  finalizeInfo: undefined,
  headline: 'the headline',
  headlineDecorated: 'the headline decorated',
  isDefaultConv: false,
  isEmpty: false,
  isPublic: false,
  maxMsgID: 5 as T.RPCChat.MessageID,
  maxVisibleMsgID: 5 as T.RPCChat.MessageID,
  memberStatus: T.RPCChat.ConversationMemberStatus.active,
  membersType: T.RPCChat.ConversationMembersType.team,
  name: 'acme',
  notifications: undefined,
  participants: undefined,
  pinnedMsg: undefined,
  readMsgID: 5 as T.RPCChat.MessageID,
  resetParticipants: undefined,
  snippet: 'the snippet',
  snippetDecorated: 'the snippet decorated',
  snippetDecoration: T.RPCChat.SnippetDecoration.none,
  status: T.RPCChat.ConversationStatus.unfiled,
  supersededBy: undefined,
  supersedes: undefined,
  teamRetention: undefined,
  teamType: T.RPCChat.TeamType.simple,
  time: 12345,
  tlfID: 'tlfIDTeam' as T.RPCChat.TLFIDStr,
  topicType: T.RPCChat.TopicType.chat,
  version: 1 as T.RPCChat.ConversationVers,
  localVersion: 1 as T.RPCChat.LocalConversationVers,
  visibility: T.RPCGen.TLFVisibility.private,
  ...overrides,
})

const makeUnverifiedFixture = (
  overrides: Partial<T.RPCChat.UnverifiedInboxUIItem> = {}
): T.RPCChat.UnverifiedInboxUIItem => ({
  commands,
  convID: 'convIDAdhoc' as T.RPCChat.ConvIDStr,
  convRetention: undefined,
  draft: undefined,
  finalizeInfo: undefined,
  isDefaultConv: false,
  isPublic: false,
  localMetadata: {
    channelName: '',
    headline: '',
    headlineDecorated: '',
    resetParticipants: undefined,
    snippet: 'unverified snippet',
    snippetDecoration: T.RPCChat.SnippetDecoration.none,
    writerNames: undefined,
  },
  maxMsgID: 3 as T.RPCChat.MessageID,
  maxVisibleMsgID: 3 as T.RPCChat.MessageID,
  memberStatus: T.RPCChat.ConversationMemberStatus.active,
  membersType: T.RPCChat.ConversationMembersType.impteamnative,
  name: 'testuser,testuser-mac',
  notifications: undefined,
  readMsgID: 3 as T.RPCChat.MessageID,
  status: T.RPCChat.ConversationStatus.unfiled,
  supersededBy: undefined,
  supersedes: undefined,
  teamRetention: undefined,
  teamType: T.RPCChat.TeamType.none,
  time: 6789,
  tlfID: 'tlfIDAdhoc' as T.RPCChat.TLFIDStr,
  topicType: T.RPCChat.TopicType.chat,
  version: 2 as T.RPCChat.ConversationVers,
  localVersion: 2 as T.RPCChat.LocalConversationVers,
  visibility: T.RPCGen.TLFVisibility.private,
  ...overrides,
})

describe('meta converters', () => {
  it('trusted team item maps fields', () => {
    const meta = inboxUIItemToConversationMeta(makeTrustedFixture())
    expect(meta?.trustedState).toBe('trusted')
    expect(meta?.snippet).toBe('the snippet')
    expect(meta?.channelname).toBe('')
    expect(meta?.teamname).toBe('acme')
    expect(meta?.teamType).toBe('small')
    expect(meta?.resetParticipants).toEqual(new Set())
    expect(meta?.isMuted).toBe(false)
    expect(meta?.notificationsDesktop).toBe('never')
  })

  it('trusted adhoc item with reset participants maps fields', () => {
    const meta = inboxUIItemToConversationMeta(
      makeTrustedFixture({
        channel: 'general',
        membersType: T.RPCChat.ConversationMembersType.impteamnative,
        name: 'testuser,testuser-mac',
        resetParticipants: ['testuser-mac'],
        teamType: T.RPCChat.TeamType.none,
      })
    )
    expect(meta?.trustedState).toBe('trusted')
    expect(meta?.teamType).toBe('adhoc')
    expect(meta?.teamname).toBe('')
    expect(meta?.channelname).toBe('')
    expect(meta?.resetParticipants).toEqual(new Set(['testuser-mac']))
  })

  it('trusted muted item with retention set maps fields', () => {
    const meta = inboxUIItemToConversationMeta(
      makeTrustedFixture({
        convRetention: {retain: {}, typ: T.RPCChat.RetentionPolicyType.retain},
        status: T.RPCChat.ConversationStatus.muted,
      })
    )
    expect(meta?.isMuted).toBe(true)
    expect(meta?.retentionPolicy.type).toBe('retain')
    expect(getEffectiveRetentionPolicy(meta!).type).toBe('retain')
  })

  it('returns undefined for non-private trusted items', () => {
    const meta = inboxUIItemToConversationMeta(
      makeTrustedFixture({visibility: T.RPCGen.TLFVisibility.public})
    )
    expect(meta).toBeUndefined()
  })

  it('unverified item maps fields', () => {
    const meta = unverifiedInboxUIItemToConversationMeta(makeUnverifiedFixture())
    expect(meta?.trustedState).toBe('untrusted')
    expect(meta?.snippet).toBe('unverified snippet')
    expect(meta?.channelname).toBe('')
    expect(meta?.teamname).toBe('')
    expect(meta?.teamType).toBe('adhoc')
    expect(meta?.resetParticipants).toEqual(new Set())
    // fields the unverified path must NOT set (trusted-only fields stay defaults)
    expect(meta?.botAliases).toEqual({})
    expect(meta?.isEmpty).toBe(false)
    expect(meta?.pinnedMsg).toBeUndefined()
    expect(meta?.minWriterRole).toBe('reader')
  })

  it('unverified team item with reset participants and muted status maps fields', () => {
    const meta = unverifiedInboxUIItemToConversationMeta(
      makeUnverifiedFixture({
        localMetadata: {
          channelName: 'general',
          headline: 'headline',
          headlineDecorated: 'headline decorated',
          resetParticipants: ['testuser-mac'],
          snippet: 'team snippet',
          snippetDecoration: T.RPCChat.SnippetDecoration.none,
          writerNames: undefined,
        },
        membersType: T.RPCChat.ConversationMembersType.team,
        name: 'acme',
        status: T.RPCChat.ConversationStatus.muted,
        teamType: T.RPCChat.TeamType.simple,
      })
    )
    expect(meta?.trustedState).toBe('untrusted')
    expect(meta?.teamname).toBe('acme')
    expect(meta?.channelname).toBe('general')
    expect(meta?.teamType).toBe('small')
    expect(meta?.isMuted).toBe(true)
    // team (not impteam) members type never populates resetParticipants
    expect(meta?.resetParticipants).toEqual(new Set())
  })

  it('unverified adhoc item with reset participants maps fields', () => {
    const meta = unverifiedInboxUIItemToConversationMeta(
      makeUnverifiedFixture({
        localMetadata: {
          channelName: '',
          headline: '',
          headlineDecorated: '',
          resetParticipants: ['testuser-mac'],
          snippet: 'adhoc snippet',
          snippetDecoration: T.RPCChat.SnippetDecoration.none,
          writerNames: undefined,
        },
      })
    )
    expect(meta?.resetParticipants).toEqual(new Set(['testuser-mac']))
  })

  it('returns undefined for non-private unverified items', () => {
    const meta = unverifiedInboxUIItemToConversationMeta(
      makeUnverifiedFixture({visibility: T.RPCGen.TLFVisibility.public})
    )
    expect(meta).toBeUndefined()
  })
})
