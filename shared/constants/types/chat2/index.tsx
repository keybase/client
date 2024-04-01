import type * as T from '@/constants/types'
import * as Common from './common'
import * as RPCTypes from '../rpc-gen'
import * as _Message from './message'
import type * as Meta from './meta'
import {uint8ArrayToHex, hexToUint8Array} from 'uint8array-extras'

export type PaymentConfirmInfo = {
  error?: RPCTypes.Status
  summary?: T.RPCChat.UIChatPaymentSummary
}

// Static config data we use for various things
export type StaticConfig = {
  deletableByDeleteHistory: Set<_Message.MessageType>
  builtinCommands: {
    [K in T.RPCChat.ConversationBuiltinCommandTyp]: Array<T.RPCChat.ConversationCommand>
  }
}

export type MetaMap = Map<Common.ConversationIDKey, Meta.ConversationMeta>
export type ConversationCountMap = Map<Common.ConversationIDKey, number>

export type ThreadSearchStatus = 'initial' | 'inprogress' | 'done'

export type ThreadSearchInfo = {
  status: ThreadSearchStatus
  hits: ReadonlyArray<_Message.Message>
  visible: boolean
}

export type InboxSearchStatus = 'initial' | 'inprogress' | 'success' | 'error'

export type InboxSearchTextHit = {
  conversationIDKey: Common.ConversationIDKey
  name: string
  numHits: number
  query: string
  teamType: 'big' | 'small'
  time: number
}

export type InboxSearchConvHit = {
  conversationIDKey: Common.ConversationIDKey
  name: string
  teamType: 'big' | 'small'
}

export type InboxSearchOpenTeamHit = {
  description: string
  inTeam: boolean
  name: string
  memberCount: number
  publicAdmins: ReadonlyArray<string>
}

export type InboxSearchInfo = {
  indexPercent: number
  botsResults: ReadonlyArray<RPCTypes.FeaturedBot>
  botsResultsSuggested: boolean
  botsStatus: InboxSearchStatus
  nameResults: ReadonlyArray<InboxSearchConvHit>
  nameResultsUnread: boolean
  nameStatus: InboxSearchStatus
  openTeamsResults: ReadonlyArray<InboxSearchOpenTeamHit>
  openTeamsResultsSuggested: boolean
  openTeamsStatus: InboxSearchStatus
  query: string
  selectedIndex: number
  textResults: ReadonlyArray<InboxSearchTextHit>
  textStatus: InboxSearchStatus
}

export type CenterOrdinalHighlightMode = 'none' | 'flash' | 'always'

export type CenterOrdinal = {
  ordinal: _Message.Ordinal
  highlightMode: CenterOrdinalHighlightMode
}

export type AttachmentViewStatus = 'loading' | 'success' | 'error'

export type AttachmentViewInfo = {
  status: AttachmentViewStatus
  messages: ReadonlyArray<_Message.Message>
  last: boolean
}

export type AttachmentFullscreenSelection = {
  autoPlay: boolean
  message: _Message.Message
}

export type CommandStatusInfo = {
  displayText: string
  displayType: T.RPCChat.UICommandStatusDisplayTyp
  actions: Array<T.RPCChat.UICommandStatusActionTyp>
}

export type UserReacjis = {
  topReacjis: Array<RPCTypes.UserReacji>
  skinTone: RPCTypes.ReacjiSkinTone
}

export type Coordinate = {
  accuracy: number
  lat: number
  lon: number
}

export type BlockButtonsInfo = {
  adder: string
}

export type BotPublicCommands = T.Immutable<{
  loadError: boolean
  commands: Array<string>
}>

export type CreateConversationError = {
  allowedUsers: Array<string>
  code: number
  disallowedUsers: Array<string>
  message: string
}

export type ParticipantInfo = T.Immutable<{
  all: Array<string> // all member usernames, including bots
  name: Array<string> // member usernames not including bots
  contactName: Map<string, string> // member username -> contact name
}>

// Corresponds to skinTones in emoji-datasource.
export type EmojiSkinTone = '1F3FA' | '1F3FB' | '1F3FC' | '1F3FD' | '1F3FE' | '1F3FF'

export const EmojiSkinToneToRPC = (emojiSkinTone: undefined | EmojiSkinTone): RPCTypes.ReacjiSkinTone => {
  switch (emojiSkinTone) {
    case undefined:
    case '1F3FA':
      return RPCTypes.ReacjiSkinTone.none
    case '1F3FB':
      return RPCTypes.ReacjiSkinTone.skintone1
    case '1F3FC':
      return RPCTypes.ReacjiSkinTone.skintone2
    case '1F3FD':
      return RPCTypes.ReacjiSkinTone.skintone3
    case '1F3FE':
      return RPCTypes.ReacjiSkinTone.skintone4
    case '1F3FF':
      return RPCTypes.ReacjiSkinTone.skintone5
  }
}

export const EmojiSkinToneFromRPC = (reacjiSkinTone: RPCTypes.ReacjiSkinTone): undefined | EmojiSkinTone => {
  switch (reacjiSkinTone) {
    case RPCTypes.ReacjiSkinTone.none:
      return undefined
    case RPCTypes.ReacjiSkinTone.skintone1:
      return '1F3FB'
    case RPCTypes.ReacjiSkinTone.skintone2:
      return '1F3FC'
    case RPCTypes.ReacjiSkinTone.skintone3:
      return '1F3FD'
    case RPCTypes.ReacjiSkinTone.skintone4:
      return '1F3FE'
    case RPCTypes.ReacjiSkinTone.skintone5:
      return '1F3FF'
  }
}

export const SkinToneToDotColor = (skinTone: undefined | EmojiSkinTone): string => {
  switch (skinTone) {
    case undefined:
    case '1F3FA':
      return '#ffc93a'
    case '1F3FB':
      return '#fadcbc'
    case '1F3FC':
      return '#e1bb95'
    case '1F3FD':
      return '#bf9068'
    case '1F3FE':
      return '#9b643d'
    case '1F3FF':
      return '#5a4539'
  }
}

export type RenderMessageType =
  | _Message.MessageType
  | 'attachment:image'
  | 'attachment:audio'
  | 'attachment:file'
  | 'attachment:video'

export const conversationIDToKey = (conversationID: T.RPCChat.ConversationID): Common.ConversationIDKey =>
  Common.stringToConversationIDKey(uint8ArrayToHex(conversationID))

export const keyToConversationID = (key: Common.ConversationIDKey): T.RPCChat.ConversationID =>
  hexToUint8Array(Common.conversationIDKeyToString(key))

export const rpcOutboxIDToOutboxID = (outboxID: T.RPCChat.OutboxID): _Message.OutboxID =>
  _Message.stringToOutboxID(uint8ArrayToHex(outboxID))

export const outboxIDToRpcOutboxID = (outboxID: _Message.OutboxID): T.RPCChat.OutboxID =>
  hexToUint8Array(_Message.outboxIDToString(outboxID))

export * from './message'
export * from './common'
export * from './meta'
export * from './rowitem'
