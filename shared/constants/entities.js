// @flow
import * as I from 'immutable'
import * as SearchConstants from './search'
import * as Teams from './teams'
import * as Git from './git'
import * as ChatConstants from './chat'
import HiddenString from '../util/hidden-string'
import {type NoErrorTypedAction} from './types/flux'
import {type DeviceDetail} from './devices'

export type EntityType = any // TODO stronger typing?

export type Delete = NoErrorTypedAction<'entity:delete', {keyPath: Array<string>, ids: I.List<string>}>
export type Merge = NoErrorTypedAction<
  'entity:merge',
  {keyPath: Array<string>, entities: I.Map<any, EntityType> | I.List<EntityType>}
>
export type Replace = NoErrorTypedAction<
  'entity:replace',
  {keyPath: Array<string>, entities: I.Map<any, EntityType>}
>
export type Subtract = NoErrorTypedAction<
  'entity:subtract',
  {keyPath: Array<string>, entities: I.List<EntityType>}
>

export type Actions = Delete | Merge | Replace | Subtract

type _SearchSubState = {
  searchResults: I.Map<SearchConstants.SearchResultId, I.RecordOf<SearchConstants.SearchResult>>,
  searchQueryToResult: I.Map<SearchConstants.SearchQuery, I.List<SearchConstants.SearchResultId>>,
  searchKeyToResults: I.Map<string, ?I.List<SearchConstants.SearchResultId>>,
  searchKeyToPending: I.Map<string, boolean>,
  searchKeyToSelectedId: I.Map<string, ?SearchConstants.SearchResultId>,
  searchKeyToShowSearchSuggestion: I.Map<string, boolean>,
  searchKeyToUserInputItemIds: I.Map<string, I.OrderedSet<SearchConstants.SearchResultId>>,
  searchKeyToSearchResultQuery: I.Map<string, ?{text: string, service: SearchConstants.Service}>,
  searchKeyToClearSearchTextInput: I.Map<string, number>,
}
type SearchSubState = I.RecordOf<_SearchSubState>

const makeSearchSubState: I.RecordFactory<_SearchSubState> = I.Record({
  searchResults: I.Map(),
  searchQueryToResult: I.Map(),
  searchKeyToResults: I.Map(),
  searchKeyToPending: I.Map(),
  searchKeyToSelectedId: I.Map(),
  searchKeyToShowSearchSuggestion: I.Map(),
  searchKeyToUserInputItemIds: I.Map(),
  searchKeyToSearchResultQuery: I.Map(),
  searchKeyToClearSearchTextInput: I.Map(),
})

type PaginationState = I.RecordOf<{
  next: I.Map<ChatConstants.ConversationIDKey, string>, // Pass this when we want to get older messages
  prev: I.Map<ChatConstants.ConversationIDKey, string>, // For when we want to get newer messages
}>

type ConversationState = I.RecordOf<{
  moreToLoad: I.Map<ChatConstants.ConversationIDKey, boolean>,
}>

const makePaginationState = I.Record({
  next: I.Map(),
  prev: I.Map(),
})

const makeConversationState = I.Record({
  moreToLoad: I.Map(),
})

// State
type _State = {
  attachmentDownloadProgress: I.Map<ChatConstants.MessageKey, ?number>,
  attachmentDownloadedPath: I.Map<ChatConstants.MessageKey, ?string>,
  attachmentPreviewPath: I.Map<ChatConstants.MessageKey, ?string>,
  attachmentPreviewProgress: I.Map<ChatConstants.MessageKey, ?number>,
  attachmentSavedPath: I.Map<ChatConstants.MessageKey, ?string>,
  attachmentUploadProgress: I.Map<ChatConstants.MessageKey, ?number>,
  convIDToSnippet: I.Map<ChatConstants.ConversationIDKey, ?HiddenString>,
  conversationMessages: I.Map<ChatConstants.ConversationIDKey, I.OrderedSet<ChatConstants.MessageKey>>,
  deletedIDs: I.Map<ChatConstants.ConversationIDKey, I.Set<ChatConstants.MessageID>>,
  devices: I.Map<string, DeviceDetail>,
  git: Git.State,
  inbox: I.Map<ChatConstants.ConversationIDKey, ChatConstants.InboxState>,
  inboxAlwaysShow: I.Map<ChatConstants.ConversationIDKey, boolean>,
  inboxBigChannels: I.Map<ChatConstants.ConversationIDKey, string>,
  inboxBigChannelsToTeam: I.Map<ChatConstants.ConversationIDKey, string>,
  inboxIsEmpty: I.Map<ChatConstants.ConversationIDKey, boolean>,
  inboxSmallTimestamps: I.Map<ChatConstants.ConversationIDKey, number>,
  inboxSupersededBy: I.Map<ChatConstants.ConversationIDKey, boolean>,
  inboxUnreadCountBadge: I.Map<ChatConstants.ConversationIDKey, number>,
  inboxUnreadCountTotal: I.Map<ChatConstants.ConversationIDKey, number>,
  inboxVersion: I.Map<ChatConstants.ConversationIDKey, number>,
  inboxUntrustedState: I.Map<ChatConstants.ConversationIDKey, ChatConstants.InboxUntrustedState>,
  messageUpdates: I.Map<
    ChatConstants.ConversationIDKey,
    I.Map<ChatConstants.MessageID, I.OrderedSet<ChatConstants.MessageKey>>
  >,
  messages: I.Map<ChatConstants.MessageKey, ChatConstants.Message>,
  pagination: PaginationState,
  conversation: ConversationState,
  search: SearchSubState,
  searchQueryToResult: I.Map<SearchConstants.SearchQuery, I.List<SearchConstants.SearchResultId>>,
  searchResults: I.Map<SearchConstants.SearchResultId, SearchConstants.SearchResult>,
  teams: Teams.State,
}

export type State = I.RecordOf<_State>
export const makeState: I.RecordFactory<_State> = I.Record({
  attachmentDownloadProgress: I.Map(),
  attachmentDownloadedPath: I.Map(),
  attachmentPreviewPath: I.Map(),
  attachmentPreviewProgress: I.Map(),
  attachmentSavedPath: I.Map(),
  attachmentUploadProgress: I.Map(),
  convIDToSnippet: I.Map(),
  conversationMessages: I.Map(),
  deletedIDs: I.Map(),
  devices: I.Map(),
  git: Git.makeState(),
  inbox: I.Map(),
  inboxAlwaysShow: I.Map(),
  inboxBigChannels: I.Map(),
  inboxBigChannelsToTeam: I.Map(),
  inboxIsEmpty: I.Map(), // maps and not sets as we don't have good helpers for that in entities yet
  inboxSmallTimestamps: I.Map(),
  inboxSupersededBy: I.Map(),
  inboxUnreadCountBadge: I.Map(),
  inboxUnreadCountTotal: I.Map(),
  inboxUntrustedState: I.Map(),
  inboxVersion: I.Map(),
  messageUpdates: I.Map(),
  messages: I.Map(),
  search: makeSearchSubState(),
  searchQueryToResult: I.Map(),
  searchResults: I.Map(),
  teams: Teams.makeState(),
  pagination: makePaginationState(),
  conversation: makeConversationState(),
})
