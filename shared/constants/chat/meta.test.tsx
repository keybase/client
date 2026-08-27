/// <reference types="jest" />
import * as T from '@/constants/types'
import {
  getEffectiveRetentionPolicy,
  getRowParticipants,
  getTeams,
  makeConversationMeta,
  parseNotificationSettings,
  updateMeta,
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

  it('an inherited conversation policy falls through to the team policy', () => {
    const meta = inboxUIItemToConversationMeta(
      makeTrustedFixture({
        convRetention: {inherit: {}, typ: T.RPCChat.RetentionPolicyType.inherit},
        teamRetention: {expire: {age: 3600 as T.RPCGen.Gregor1.DurationSec}, typ: T.RPCChat.RetentionPolicyType.expire},
      })
    )
    expect(meta?.retentionPolicy.type).toBe('inherit')
    expect(meta?.teamRetentionPolicy).toEqual({seconds: 3600, title: '60 minutes', type: 'expire'})
    expect(getEffectiveRetentionPolicy(meta!)).toBe(meta!.teamRetentionPolicy)
  })

  it('a conversation policy of its own wins over the team policy', () => {
    const meta = inboxUIItemToConversationMeta(
      makeTrustedFixture({
        convRetention: {expire: {age: 60 as T.RPCGen.Gregor1.DurationSec}, typ: T.RPCChat.RetentionPolicyType.expire},
        teamRetention: {retain: {}, typ: T.RPCChat.RetentionPolicyType.retain},
      })
    )
    expect(getEffectiveRetentionPolicy(meta!)).toBe(meta!.retentionPolicy)
    expect(getEffectiveRetentionPolicy(meta!).seconds).toBe(60)
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

describe('updateMeta', () => {
  const meta = (override: Partial<T.Chat.ConversationMeta>): T.Chat.ConversationMeta => ({
    ...makeConversationMeta(),
    ...override,
  })

  test('an older inbox version is dropped', () => {
    const old = meta({inboxVersion: 5, snippet: 'current'})
    const stale = meta({inboxVersion: 4, snippet: 'stale'})
    expect(updateMeta(old, stale)).toBe(old)
  })

  test('a newer inbox version wins', () => {
    const old = meta({inboxVersion: 5, snippet: 'current'})
    const next = meta({inboxVersion: 6, snippet: 'newer'})
    expect(updateMeta(old, next).snippet).toBe('newer')
  })

  test('at the same version, untrusted data never overwrites trusted data', () => {
    const trusted = meta({inboxVersion: 5, snippet: 'trusted', trustedState: 'trusted'})
    const untrusted = meta({inboxVersion: 5, snippet: 'untrusted', trustedState: 'untrusted'})
    expect(updateMeta(trusted, untrusted)).toBe(trusted)
  })

  test('at the same version, becoming trusted is taken', () => {
    const untrusted = meta({inboxVersion: 5, snippet: 'untrusted', trustedState: 'untrusted'})
    const trusted = meta({inboxVersion: 5, snippet: 'trusted', trustedState: 'trusted'})
    expect(updateMeta(untrusted, trusted).snippet).toBe('trusted')
  })

  test('at the same version, a bumped local version is taken', () => {
    const old = meta({inboxLocalVersion: 1, inboxVersion: 5, snippet: 'old'})
    const next = meta({inboxLocalVersion: 2, inboxVersion: 5, snippet: 'new'})
    expect(updateMeta(old, next).snippet).toBe('new')
    expect(updateMeta(old, meta({inboxLocalVersion: 1, inboxVersion: 5, snippet: 'new'}))).toBe(old)
  })

  test('deep equal fields keep their old identity so selectors can bail out', () => {
    const old = meta({inboxVersion: 5, resetParticipants: new Set(['testuser'])})
    const next = meta({
      inboxVersion: 6,
      resetParticipants: new Set(['testuser']),
      snippet: 'changed',
    })
    const merged = updateMeta(old, next)
    expect(merged.resetParticipants).toBe(old.resetParticipants)
    expect(merged.snippet).toBe('changed')
  })

  test('fields that actually changed are not carried over', () => {
    const old = meta({inboxVersion: 5, resetParticipants: new Set(['testuser'])})
    const next = meta({inboxVersion: 6, resetParticipants: new Set(['testuser-mac'])})
    expect(updateMeta(old, next).resetParticipants).toBe(next.resetParticipants)
  })
})

describe('parseNotificationSettings', () => {
  const settings = (
    device: T.RPCGen.DeviceType,
    kinds: ReadonlyArray<T.RPCChat.NotificationKind>,
    channelWide = false
  ): T.RPCChat.ConversationNotificationInfo => ({
    channelWide,
    settings: {
      [String(device)]: Object.fromEntries(kinds.map(k => [String(k), true])),
    },
  })

  test('defaults to never when the daemon says nothing', () => {
    expect(parseNotificationSettings(undefined)).toEqual({
      notificationsDesktop: 'never',
      notificationsGlobalIgnoreMentions: false,
      notificationsMobile: 'never',
    })
  })

  test('generic notifications mean any activity', () => {
    const parsed = parseNotificationSettings(
      settings(T.RPCGen.DeviceType.desktop, [T.RPCChat.NotificationKind.generic])
    )
    expect(parsed.notificationsDesktop).toBe('onAnyActivity')
    expect(parsed.notificationsMobile).toBe('never')
  })

  test('atmention only means mentions', () => {
    const parsed = parseNotificationSettings(
      settings(T.RPCGen.DeviceType.mobile, [T.RPCChat.NotificationKind.atmention])
    )
    expect(parsed.notificationsMobile).toBe('onWhenAtMentioned')
    expect(parsed.notificationsDesktop).toBe('never')
  })

  test('generic wins over atmention', () => {
    const parsed = parseNotificationSettings(
      settings(T.RPCGen.DeviceType.desktop, [
        T.RPCChat.NotificationKind.atmention,
        T.RPCChat.NotificationKind.generic,
      ])
    )
    expect(parsed.notificationsDesktop).toBe('onAnyActivity')
  })

  test('channelWide is read straight through as the ignore-mentions flag', () => {
    expect(
      parseNotificationSettings(settings(T.RPCGen.DeviceType.desktop, [], true))
        .notificationsGlobalIgnoreMentions
    ).toBe(true)
  })
})

describe('getRowParticipants', () => {
  const info = (name: Array<string>): T.Chat.ParticipantInfo => ({
    all: name,
    contactName: new Map(),
    name,
  })

  test('filters you out of a group conversation', () => {
    expect(getRowParticipants(info(['testuser', 'testuser-mac', 'other']), 'testuser')).toEqual([
      'testuser-mac',
      'other',
    ])
  })

  test('keeps you in your own self conversation', () => {
    expect(getRowParticipants(info(['testuser']), 'testuser')).toEqual(['testuser'])
  })

  test('leaves everyone alone when you are not in the list', () => {
    expect(getRowParticipants(info(['testuser-mac', 'other']), 'testuser')).toEqual([
      'testuser-mac',
      'other',
    ])
  })
})

describe('getTeams', () => {
  const metaFor = (
    conversationIDKey: string,
    teamname: string,
    channelname: string
  ): T.Chat.ConversationMeta => ({
    ...makeConversationMeta(),
    channelname,
    conversationIDKey: T.Chat.stringToConversationIDKey(conversationIDKey),
    teamname,
  })

  test('lists the team of every #general channel and nothing else', () => {
    const metaMap: T.Chat.MetaMap = new Map([
      [T.Chat.stringToConversationIDKey('a'), metaFor('a', 'teamone', 'general')],
      [T.Chat.stringToConversationIDKey('b'), metaFor('b', 'teamone', 'random')],
      [T.Chat.stringToConversationIDKey('c'), metaFor('c', 'teamtwo', 'general')],
      [T.Chat.stringToConversationIDKey('d'), metaFor('d', '', 'general')],
    ])
    expect(getTeams(metaMap)).toEqual(['teamone', 'teamtwo'])
  })

  test('is empty without any conversations', () => {
    expect(getTeams(new Map())).toEqual([])
  })
})
