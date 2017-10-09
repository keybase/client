// @flow
import * as I from 'immutable'
import * as SearchConstants from './search'
import * as Teams from './teams'
import * as Git from './git'
import * as ChatConstants from './chat'
import HiddenString from '../util/hidden-string'
import {type NoErrorTypedAction} from './types/flux'

export type EntityType = any // TODO stronger typing?

export type Delete = NoErrorTypedAction<'entity:delete', {keyPath: Array<string>, ids: Array<string>}>
export type Merge = NoErrorTypedAction<
  'entity:merge',
  {keyPath: Array<string>, entities: {[id: string]: EntityType} | Array<EntityType>}
>
export type Replace = NoErrorTypedAction<
  'entity:replace',
  {keyPath: Array<string>, entities: {[id: string]: EntityType}}
>
export type Subtract = NoErrorTypedAction<
  'entity:subtract',
  {keyPath: Array<string>, entities: Array<EntityType>}
>

export type Actions = Delete | Merge | Replace | Subtract

type _SearchSubState = {
  searchResults: Map<SearchConstants.SearchResultId, KBRecord<SearchConstants.SearchResult>>,
  searchQueryToResult: Map<SearchConstants.SearchQuery, List<SearchConstants.SearchResultId>>,
  searchKeyToResults: Map<string, ?List<SearchConstants.SearchResultId>>,
  searchKeyToPending: Map<string, boolean>,
  searchKeyToSelectedId: Map<string, ?SearchConstants.SearchResultId>,
  searchKeyToShowSearchSuggestion: Map<string, boolean>,
  searchKeyToUserInputItemIds: Map<string, OrderedSet<SearchConstants.SearchResultId>>,
  searchKeyToSearchResultQuery: Map<string, ?{text: string, service: SearchConstants.Service}>,
  searchKeyToClearSearchTextInput: Map<string, number>,
}
type SearchSubState = I.RecordOf<_SearchSubState>

const makeSearchSubState: I.RecordFactory<_SearchSubState> = I.Record({
  searchResults: Map(),
  searchQueryToResult: Map(),
  searchKeyToResults: Map(),
  searchKeyToPending: Map(),
  searchKeyToSelectedId: Map(),
  searchKeyToShowSearchSuggestion: Map(),
  searchKeyToUserInputItemIds: Map(),
  searchKeyToSearchResultQuery: Map(),
  searchKeyToClearSearchTextInput: Map(),
})

// State
type _State = {
  attachmentDownloadProgress: Map<ChatConstants.MessageKey, ?number>,
  attachmentDownloadedPath: Map<ChatConstants.MessageKey, ?string>,
  attachmentPreviewPath: Map<ChatConstants.MessageKey, ?string>,
  attachmentPreviewProgress: Map<ChatConstants.MessageKey, ?number>,
  attachmentSavedPath: Map<ChatConstants.MessageKey, ?string>,
  attachmentUploadProgress: Map<ChatConstants.MessageKey, ?number>,
  convIDToSnippet: Map<ChatConstants.ConversationIDKey, ?HiddenString>,
  conversationMessages: Map<ChatConstants.ConversationIDKey, KBOrderedSet<ChatConstants.MessageKey>>,
  deletedIDs: Map<ChatConstants.ConversationIDKey, Set<ChatConstants.MessageID>>,
  devices: Map<string, DeviceDetailRecord>,
  git: Git.GitRecord,
  inbox: Map<ChatConstants.ConversationIDKey, ChatConstants.InboxState>,
  inboxAlwaysShow: Map<ChatConstants.ConversationIDKey, boolean>,
  inboxBigChannels: Map<ChatConstants.ConversationIDKey, string>,
  inboxBigChannelsToTeam: Map<ChatConstants.ConversationIDKey, string>,
  inboxIsEmpty: Map<ChatConstants.ConversationIDKey, boolean>,
  inboxSmallTimestamps: Map<ChatConstants.ConversationIDKey, string>,
  inboxSupersededBy: Map<ChatConstants.ConversationIDKey, boolean>,
  inboxUnreadCountBadge: Map<ChatConstants.ConversationIDKey, number>,
  inboxUnreadCountTotal: Map<ChatConstants.ConversationIDKey, number>,
  inboxVersion: Map<ChatConstants.ConversationIDKey, number>,
  messageUpdates: Map<
    ChatConstants.ConversationIDKey,
    I.Map<ChatConstants.MessageID, I.OrderedSet<ChatConstants.MessageKey>>
  >,
  messages: Map<ChatConstants.MessageKey, ChatConstants.Message>,
  search: SearchSubState,
  searchQueryToResult: Map<SearchConstants.SearchQuery, List<SearchConstants.SearchResultId>>,
  searchResults: Map<SearchConstants.SearchResultId, KBRecord<SearchConstants.SearchResult>>,
  teams: Teams.TeamRecord,
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
  inbox: Map(),
  inboxAlwaysShow: Map(),
  inboxBigChannels: Map(),
  inboxBigChannelsToTeam: Map(),
  inboxIsEmpty: Map(), // maps and not sets as we don't have good helpers for that in entities yet
  inboxSmallTimestamps: Map(),
  inboxSupersededBy: Map(),
  inboxUnreadCountBadge: Map(),
  inboxUnreadCountTotal: Map(),
  inboxVersion: Map(),
  messageUpdates: I.Map(),
  messages: I.Map(),
  search: makeSearchSubState(),
  searchQueryToResult: I.Map(),
  searchResults: I.Map(),
  teams: Teams.makeState(),
})
