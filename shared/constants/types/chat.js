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
  | 'resetUser'
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

export type AddedToTeamInfo = {
  type: 'addedToTeam',
  team: string,
  adder: string,
  addee: string,
}

export type SimpleToComplexTeamInfo = {
  type: 'simpleToComplex',
  team: string,
}

export type InviteAcceptedInfo = {
  type: 'inviteAccepted',
  team: string,
  inviter: string,
  invitee: string,
  adder: string,
  inviteType: 'none' | 'unknown' | 'keybase' | 'email' | 'sbs' | 'text',
}

export type SystemMessageInfo =
  | AddedToTeamInfo
  | SimpleToComplexTeamInfo
  | InviteAcceptedInfo
  | {type: 'unknown'}

export type SystemMessage = {
  type: 'System',
  messageID?: MessageID,
  rawMessageID: number,
  author: string,
  timestamp: number,
  message: HiddenString, // Summary for snippet
  info: SystemMessageInfo,
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

export type _State = {
  alwaysShow: I.Set<ConversationIDKey>,
  channelCreationError: string,
  conversationStates: I.Map<ConversationIDKey, ConversationState>,
  conversationUnreadCounts: I.Map<ConversationIDKey, UnreadCounts>,
  editingMessage: ?Message,
  finalizedState: FinalizedState,
  inSearch: boolean,
  inbox: I.Map<ConversationIDKey, InboxState>,
  inboxAlwaysShow: I.Map<ConversationIDKey, boolean>,
  inboxBigChannels: I.Map<ConversationIDKey, string>,
  inboxBigChannelsToTeam: I.Map<ConversationIDKey, string>,
  inboxFilter: string,
  inboxIsEmpty: I.Map<ConversationIDKey, boolean>,
  inboxSearch: I.List<string>,
  inboxSmallTimestamps: I.Map<ConversationIDKey, number>,
  inboxSnippet: I.Map<ConversationIDKey, ?HiddenString>,
  inboxSupersededBy: I.Map<ConversationIDKey, boolean>,
  inboxUnreadCountBadge: I.Map<ConversationIDKey, number>,
  inboxUnreadCountTotal: I.Map<ConversationIDKey, number>,
  inboxResetParticipants: I.Map<ConversationIDKey, I.Set<string>>,
  inboxUntrustedState: I.Map<ConversationIDKey, InboxUntrustedState>,
  inboxGlobalUntrustedState: UntrustedState,
  inboxSyncingState: SyncingState,
  inboxVersion: I.Map<ConversationIDKey, number>,
  initialConversation: ?ConversationIDKey,
  localMessageStates: I.Map<MessageKey, LocalMessageState>,
  messageMap: I.Map<MessageKey, Message>,
  metaData: MetaDataMap,
  nowOverride: ?Date,
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
  teamJoinSuccessTeamName: ?string,
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
