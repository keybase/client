/// <reference types="jest" />
import * as Meta from '@/constants/chat/meta'
import {bodyToJSON} from '@/constants/rpc-utils'
import * as T from '@/constants/types'

const encodeText = (text: string) => new TextEncoder().encode(text)

const makeConversationMetadata = (
  conversationID: T.RPCChat.ConversationID | string
): T.RPCChat.ConversationMetadata => ({
  activeList: null,
  allList: null,
  conversationID: conversationID as T.RPCChat.ConversationID,
  d: false,
  existence: T.RPCChat.ConversationExistence.active,
  finalizeInfo: {
    resetDate: '',
    resetFull: '',
    resetTimestamp: 0,
    resetUser: 'alice',
  },
  idTriple: {
    tlfid: new Uint8Array([1]),
    topicID: new Uint8Array([2]),
    topicType: T.RPCChat.TopicType.chat,
  },
  localVersion: 1,
  membersType: T.RPCChat.ConversationMembersType.impteamnative,
  resetList: null,
  status: T.RPCChat.ConversationStatus.unfiled,
  supersededBy: null,
  supersedes: null,
  teamType: T.RPCChat.TeamType.simple,
  version: 1,
  visibility: T.RPCGen.TLFVisibility.private,
})

const makeUnverifiedInboxUIItem = (
  overrides?: Partial<T.RPCChat.UnverifiedInboxUIItem>
): T.RPCChat.UnverifiedInboxUIItem => ({
  commands: {typ: T.RPCChat.ConversationCommandGroupsTyp.none},
  convID: 'feedface',
  convRetention: null,
  draft: '',
  finalizeInfo: null,
  isDefaultConv: false,
  isPublic: false,
  localMetadata: null,
  localVersion: 1,
  maxMsgID: 0,
  maxVisibleMsgID: 0,
  memberStatus: T.RPCChat.ConversationMemberStatus.active,
  membersType: T.RPCChat.ConversationMembersType.impteamnative,
  name: 'alice,bob',
  notifications: null,
  readMsgID: 0,
  status: T.RPCChat.ConversationStatus.unfiled,
  supersededBy: null,
  supersedes: null,
  teamRetention: null,
  teamType: T.RPCChat.TeamType.simple,
  time: 0,
  tlfID: 'tlf-id',
  topicType: T.RPCChat.TopicType.chat,
  version: 1,
  visibility: T.RPCGen.TLFVisibility.private,
  ...overrides,
})

test('bodyToJSON decodes UTF-8 JSON payloads used by RPC helpers', () => {
  const payload = {message: 'hello🙂', nested: {count: 2}}

  expect(bodyToJSON(encodeText(JSON.stringify(payload)))).toEqual(payload)
})

test('conversation and outbox ID helpers round-trip binary values and preserve leading zeros', () => {
  const conversationID = new Uint8Array([0, 1, 2, 15, 16, 127, 128, 255])
  const outboxID = new Uint8Array([0, 0, 16, 32, 48, 64, 255])

  const conversationKey = T.Chat.conversationIDToKey(conversationID)
  const outboxKey = T.Chat.rpcOutboxIDToOutboxID(outboxID)

  expect(conversationKey).toBe('0001020f107f80ff')
  expect(outboxKey).toBe('000010203040ff')
  expect(T.Chat.keyToConversationID(conversationKey)).toEqual(conversationID)
  expect(T.Chat.outboxIDToRpcOutboxID(outboxKey)).toEqual(outboxID)
})

test('conversation metadata tolerates base64 and Uint8Array supersede IDs from the service', () => {
  const supersedesID = new Uint8Array([0, 17, 34, 51, 68, 85])
  const supersededByID = new Uint8Array([102, 119, 136, 153, 170, 187])
  const item = makeUnverifiedInboxUIItem({
    // The service has historically sent base64 strings here even though the generated type says Uint8Array.
    supersededBy: [makeConversationMetadata(supersededByID)],
    supersedes: [makeConversationMetadata(Buffer.from(supersedesID).toString('base64'))],
  })

  const meta = Meta.unverifiedInboxUIItemToConversationMeta(item)

  expect(meta?.supersedes).toBe(T.Chat.conversationIDToKey(supersedesID))
  expect(meta?.supersededBy).toBe(T.Chat.conversationIDToKey(supersededByID))
})
