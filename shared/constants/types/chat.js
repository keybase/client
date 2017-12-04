// @flow
import * as I from 'immutable'
import * as RPCChatTypes from './flow-types-chat'
import * as RPCTypes from './flow-types'
import * as SearchTypes from './search'
import HiddenString from '../../util/hidden-string'
import type {DeviceType} from './devices'

export type Username = string
export type MessageKey = string
export type MessageKeyKind =
  | 'chatSecured'
  | 'error'
  | 'errorInvisible'
  | 'header'
  | 'messageIDAttachment'
  | 'messageIDDeleted'
  | 'messageIDEdit'
  | 'messageIDAttachmentUpdate'
  | 'messageIDError'
  | 'messageIDText'
  | 'messageIDUnhandled'
  | 'outboxIDAttachment'
  | 'outboxIDText'
  | 'timestamp'
  | 'supersedes'
  | 'system'
  | 'joinedleft'

// TODO: Ideally, this would be 'Text' | 'Error' | etc.
export type MessageType = string
export type FollowingMap = {[key: string]: true}

export type MessageState = 'pending' | 'failed' | 'sent'

export type AttachmentMessageState = MessageState | 'placeholder' | 'uploading'
export type AttachmentType = 'Image' | 'Video' | 'Other'

export type ConversationID = RPCChatTypes.ConversationID
export type ConversationIDKey = string

export type OutboxID = RPCChatTypes.OutboxID
export type OutboxIDKey = string

export type MessageID = string

export type NotifyType = 'atmention' | 'generic' | 'never'
export type Mentions = I.Set<string>
export type ChannelMention = 'None' | 'All' | 'Here'
export type TextMessage = {
  type: 'Text',
  message: HiddenString,
  author: string,
  deviceName: string,
  deviceType: DeviceType,
  timestamp: number,
  conversationIDKey: ConversationIDKey,
  messageID?: MessageID,
  you: string,
  messageState: MessageState,
  rawMessageID: number,
  failureDescription: ?string,
  outboxID?: ?OutboxIDKey,
  senderDeviceRevokedAt: ?number,
  key: MessageKey,
  editedCount: number, // increase as we edit it
  mentions: Mentions,
  channelMention: ChannelMention,
  ordinal: number,
}
export type ErrorMessage = {
  type: 'Error',
  reason: string,
  timestamp?: number,
  conversationIDKey: ConversationIDKey,
  messageID?: MessageID,
  key: MessageKey,
  rawMessageID: number,
}

export type InvisibleErrorMessage = {
  type: 'InvisibleError',
  timestamp: number,
  conversationIDKey: ConversationIDKey,
  messageID: MessageID,
  key: MessageKey,
  data: any,
  rawMessageID: number,
}

export type UnhandledMessage = {
  type: 'Unhandled',
  timestamp: number,
  conversationIDKey: ConversationIDKey,
  messageID: MessageID,
  key: MessageKey,
  rawMessageID: number,
}

export type AttachmentSize = {
  width: number,
  height: number,
}

export type AttachmentInput = {
  conversationIDKey: ConversationIDKey,
  filename: string,
  title: string,
  type: AttachmentType,
}

export type AttachmentMessage = {
  type: 'Attachment',
  timestamp: number,
  conversationIDKey: ConversationIDKey,
  you: string,
  author: string,
  deviceName: string,
  deviceType: DeviceType,
  messageID?: MessageID,
  rawMessageID: number,
  filename: ?string,
  title: ?string,
  attachmentDurationMs: ?number,
  previewType: ?AttachmentType,
  previewSize: ?AttachmentSize,
  previewDurationMs: ?number,
  uploadPath?: string,
  outboxID?: ?OutboxIDKey,
  messageState: AttachmentMessageState,
  senderDeviceRevokedAt: ?number,
  key: MessageKey,
  failureDescription?: ?string,
  ordinal: number,
}

export type TimestampMessage = {
  type: 'Timestamp',
  timestamp: number,
  key: MessageKey,
}

export type LoadingMoreMessage = {
  type: 'LoadingMore',
  key: MessageKey,
}

export type ChatSecuredHeaderMessage = {
  type: 'ChatSecuredHeader',
  key: MessageKey,
}

export type JoinedLeftMessage = {
  type: 'JoinedLeft',
  messageID?: MessageID,
  rawMessageID: number,
  author: string,
  timestamp: number,
  message: HiddenString,
  key: MessageKey,
  ordinal: number,
}

export type SystemMessage = {
  type: 'System',
  messageID?: MessageID,
  rawMessageID: number,
  author: string,
  timestamp: number,
  message: HiddenString,
  key: MessageKey,
  ordinal: number,
}

export type SupersedesMessage = {
  type: 'Supersedes',
  username: string,
  timestamp: number,
  supersedes: ConversationIDKey,
  key: any,
}

export type DeletedMessage = {
  type: 'Deleted',
  timestamp: number,
  key: MessageKey,
  messageID: MessageID,
  rawMessageID: number,
  deletedIDs: Array<MessageID>,
}

export type EditingMessage = {
  type: 'Edit',
  key: MessageKey,
  message: HiddenString,
  messageID: MessageID,
  rawMessageID: number,
  outboxID?: ?OutboxIDKey,
  targetMessageID: MessageID,
  timestamp: number,
  mentions: Mentions,
  channelMention: ChannelMention,
  ordinal: number,
}

export type UpdatingAttachment = {
  type: 'UpdateAttachment',
  key: MessageKey,
  messageID: MessageID,
  rawMessageID: number,
  targetMessageID: MessageID,
  timestamp: number,
  updates: {
    attachmentDurationMs: ?number,
    filename: ?string,
    messageState: 'sent',
    previewType: ?AttachmentType,
    previewSize: ?AttachmentSize,
    previewDurationMs: ?number,
    title: ?string,
  },
}

export type ClientMessage =
  | TimestampMessage
  | SupersedesMessage
  | LoadingMoreMessage
  | ChatSecuredHeaderMessage
export type ServerMessage =
  | TextMessage
  | ErrorMessage
  | AttachmentMessage
  | DeletedMessage
  | UnhandledMessage
  | EditingMessage
  | UpdatingAttachment
  | InvisibleErrorMessage
  | SystemMessage
  | JoinedLeftMessage

export type Message = ClientMessage | ServerMessage

export type ConversationMessages = I.RecordOf<{
  high: number,
  low: number,
  messages: I.List<MessageKey>,
}>

export type MaybeTimestamp = TimestampMessage | null
export type _ConversationState = {
  moreToLoad: ?boolean,
  isLoaded: boolean,
  isRequesting: boolean,
  isStale: boolean,
  loadedOffline: boolean,
  paginationNext: ?string,
  paginationPrevious: ?string,
  firstNewMessageID: ?MessageID,
  typing: I.Set<Username>,
}
export type _ConversationBadgeState = {
  convID: ?ConversationID,
  unreadMessages: number,
  badgeCounts: {[key: string]: number},
}
export type ConversationState = I.RecordOf<_ConversationState>
export type ConversationBadgeState = I.RecordOf<_ConversationBadgeState>
export type ConversationStateEnum = $Keys<typeof RPCChatTypes.commonConversationStatus>

export type NotificationsKindState = {
  generic: boolean,
  atmention: boolean,
}

export type NotificationsState = {
  channelWide: boolean,
  desktop: NotificationsKindState,
  mobile: NotificationsKindState,
}

// firstUnboxing is when its going from untrusted to unboxing vs unboxed to reUnboxing
export type InboxUntrustedState = 'untrusted' | 'unboxed' | 'error' | 'firstUnboxing' | 'reUnboxing'

export type _InboxState = {
  conversationIDKey: ConversationIDKey,
  info: ?RPCChatTypes.ConversationInfoLocal,
  isEmpty: boolean,
  teamname: ?string,
  channelname: ?string,
  maxMsgID: ?number,
  name: ?string,
  memberStatus: RPCChatTypes.ConversationMemberStatus,
  membersType: RPCChatTypes.ConversationMembersType,
  notifications: ?NotificationsState,
  participants: I.List<string>,
  fullNames: I.Map<string, string>,
  status: ConversationStateEnum,
  time: number,
  teamType: RPCChatTypes.TeamType,
  version: RPCChatTypes.ConversationVers,
  visibility: RPCTypes.TLFVisibility,
}

export type InboxState = I.RecordOf<_InboxState>
export type SupersedeInfo = {
  conversationIDKey: ConversationIDKey,
  finalizeInfo: RPCChatTypes.ConversationFinalizeInfo,
}

export type FinalizeInfo = RPCChatTypes.ConversationFinalizeInfo

export type FinalizedState = I.Map<ConversationIDKey, RPCChatTypes.ConversationFinalizeInfo>

export type SupersedesState = I.Map<ConversationIDKey, SupersedeInfo>
export type SupersededByState = I.Map<ConversationIDKey, SupersedeInfo>

export type _MetaData = {
  fullname: string,
  brokenTracker: boolean,
}
export type MetaData = I.RecordOf<_MetaData>
export type MetaDataMap = I.Map<string, MetaData>

export type Participants = I.List<string>

export type _RekeyInfo = {
  rekeyParticipants: Participants,
  youCanRekey: boolean,
}

export type RekeyInfo = I.RecordOf<_RekeyInfo>
export type LocalMessageState = {
  previewProgress: number | null /* between 0 - 1 */,
  downloadProgress: number | null /* between 0 - 1 */,
  uploadProgress: number | null /* between 0 - 1 */,
  previewPath: ?string,
  downloadedPath: ?string,
  savedPath: string | null | false,
}

export type UntrustedState = 'unloaded' | 'loaded' | 'loading'
export type SyncingState = 'syncing' | 'notSyncing'

export type UnreadCounts = {
  total: number,
  badged: number,
}

/***
 * Theory:
 *
 * All we have a threads.
 * Each thread has a conversation id
 * A thread has a window of messages we've downloaded (oldest, newest) plus metadata about it (muted, etc). The inbox 'version' basically increments whenver anything changes
 * We know if oldest is the global oldest (aka moreToLoad)
 * We know if the newest is the global newest (aka sync calls etc tell us if we're out of date)
 * Threads have a team type, aka small team (teamname + #general), big team (teamname + channelname) , or kbfs team (name aka participants list)
 * We know if the thread is finalized (has forward / back pointers)
 *
 * The inbox data is entirely derivable from the threads
 * We can get every thread, pull its type and its latest message and build the list / tree / snippet
 * When we 'load' the inbox we're essentially asking the server to give us the newest message of every thread
 * When we get a sync call the server is telling us our current thread window isn't the newest
 * Can we effeciently use reselect to derive this?
 *  assuming we have a Map<id, ThreadVersion>, whenever that changes we do a reselect to pull out the
 *  type and timestamp, teamname, channelname
 *  we  use rereselect  with teh cachekey based on the convoid where we do
 *
 *  const getThread = (state, threadId) => state.chat.threadMap.get(threadId)
 *
 *  createCachedSelector(
 *  [getThread],
 *  (thread) => {
 *  // derive timestamp, teamname, channelname etc
 *
 *  },
 *  (state, threadId) => threadId // cachekey
 *
 * The thread should be more stateful. We should keep track of the requesting state for both sides of the window (i asked for newer than the newest or older than the oldest) so loadmore can be correct always.
 * isEmpty is derived from an emtpy window with no more to reqeust on either side
 *
 * sending:
 * ? maybe we make an ordinal based on the last thing and just inject it in and keep state on the message about itself
 *
 * superseded
 * hopefully we don't need to keep these around and instead can just apply it and toss the old version. from our perspective we don't need to keep it and its just an action to apply to our playload
 *
 * rekey info can be in a sep. part
 *
 ***/

// WIP types
type __ThreadId = string
type __MessageId = string

// Rekey info
type __Rekey = {

}

// A message
type __Message = {
  id: __MessageId,
}

// A single conversation
type __Thread = {
  version: number, // monotonically increasing number we get from the service to represent mutations to the state
  idToMessage: I.Map<__MessageId, __Message>, // map of messageId to Message
  messagesIdsInOrder: I.List<__MessageId>, // an ordered list of message ids we know about, no gaps allowed.
}

type __State = {
  idToThread: I.Map<__ThreadId, __Thread>,
  idToRekeyers: I.Map<__ThreadId, I.Set(string)>,
}

// Returns the min/max we know about
// function getThreadWindow(t: __Thread) {
// const first = t.messagesIdsInOrder.first()
// const last = t.messagesIdsInOrder.last()

// return {
// max: first ? first.id : null,
// min: last ? last.id : null,
// }
// }

/***
 *
 *
 * Thread
 *
 *
 *
 *
 *
 */

/***
 *
 * notes:
 *
 * features to support:
 *
 * messages come in. that updates the thread and inbox
 * we get the inbox, which is basically a single message
 *
 * we have inbox items that can represent a convo thats not started yet (pending aka alwaysshow)
 *
 * inbox:
 * item: number of unread messages (badging)
 * big channels, big teams
 * small teams
 * filter
 * global state of inbox
 * syncing state
 * inbox version <<<< rely on this more
 *
 *
 * thread
 * window of messages
 * state of window (are we at the end)
 * if finalized (pointers back / forward)
 *
 * misc:
 * are we searching
 *
 *
 *
 *
 *
 ***/

type _StateInbox = {
  // really all of these are derived....
  inboxBigChannels: I.Map<ConversationIDKey, string>,
  inboxBigChannelsToTeam: I.Map<ConversationIDKey, string>,
  inboxSmallTimestamps: I.Map<ConversationIDKey, number>,
}

type _StateThread = {}

export type _State = _StateInbox &
  _StateThread & {
    alwaysShow: I.Set<ConversationIDKey>,
    channelCreationError: string,
    conversationStates: I.Map<ConversationIDKey, ConversationState>,
    conversationUnreadCounts: I.Map<ConversationIDKey, UnreadCounts>,
    editingMessage: ?Message,
    finalizedState: FinalizedState,
    inSearch: boolean,
    inbox: I.Map<ConversationIDKey, InboxState>,
    inboxAlwaysShow: I.Map<ConversationIDKey, boolean>,
    inboxFilter: string,
    inboxIsEmpty: I.Map<ConversationIDKey, boolean>,
    inboxSearch: I.List<string>,
    inboxSnippet: I.Map<ConversationIDKey, ?HiddenString>, // do we need this
    inboxSupersededBy: I.Map<ConversationIDKey, boolean>, // move to thread
    inboxUnreadCountBadge: I.Map<ConversationIDKey, number>, // move to thread
    inboxUnreadCountTotal: I.Map<ConversationIDKey, number>, // move to thread
    inboxUntrustedState: I.Map<ConversationIDKey, InboxUntrustedState>, // move to thread
    inboxGlobalUntrustedState: UntrustedState,
    inboxSyncingState: SyncingState,
    inboxVersion: I.Map<ConversationIDKey, number>,
    initialConversation: ?ConversationIDKey,
    localMessageStates: I.Map<MessageKey, LocalMessageState>, // should just go into the message
    messageMap: I.Map<MessageKey, Message>,
    metaData: MetaDataMap,
    nowOverride: ?Date, // should just be a part of the inbox render
    pendingConversations: I.Map<ConversationIDKey, Participants>,
    previousConversation: ?ConversationIDKey,
    rekeyInfos: I.Map<ConversationIDKey, RekeyInfo>,
    searchPending: boolean,
    searchResultTerm: string,
    searchResults: ?I.List<SearchTypes.SearchResultId>,
    searchShowingSuggestions: boolean,
    selectedUsersInSearch: I.List<SearchTypes.SearchResultId>,
    supersededByState: SupersededByState,
    supersedesState: SupersedesState,
    teamCreationError: string,
    teamCreationPending: boolean,
    teamJoinError: string,
    teamJoinSuccess: boolean,
    tempPendingConversations: I.Map<ConversationIDKey, boolean>,
  }

export type State = I.RecordOf<_State>
export type ParsedMessageID =
  | {
      type: 'rpcMessageID',
      msgID: RPCChatTypes.MessageID,
    }
  | {
      type: 'outboxID',
      msgID: OutboxID,
    }
  | {
      type: 'selfInventedID',
      msgID: number,
    }
  | {
      type: 'invalid',
      msgID: number,
    }
