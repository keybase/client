// @flow
import * as I from 'immutable'
import * as SearchConstants from './search'
import * as Teams from './teams'
import * as Git from './git'
import * as ChatTypes from './types/chat'
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
  next: I.Map<ChatTypes.ConversationIDKey, string>, // Pass this when we want to get older messages
  prev: I.Map<ChatTypes.ConversationIDKey, string>, // For when we want to get newer messages
}>

const makePaginationState = I.Record({
  next: I.Map(),
  prev: I.Map(),
})

// State
type _State = {
  attachmentDownloadProgress: I.Map<ChatTypes.MessageKey, ?number>,
  attachmentDownloadedPath: I.Map<ChatTypes.MessageKey, ?string>,
  attachmentPreviewPath: I.Map<ChatTypes.MessageKey, ?string>,
  attachmentPreviewProgress: I.Map<ChatTypes.MessageKey, ?number>,
  attachmentSavedPath: I.Map<ChatTypes.MessageKey, ?string>,
  attachmentUploadProgress: I.Map<ChatTypes.MessageKey, ?number>,
  conversationMessages: I.Map<ChatTypes.ConversationIDKey, I.OrderedSet<ChatTypes.MessageKey>>,
  deletedIDs: I.Map<ChatTypes.ConversationIDKey, I.Set<ChatTypes.MessageID>>,
  devices: I.Map<string, DeviceDetail>,
  git: Git.State,
  messageUpdates: I.Map<
    ChatTypes.ConversationIDKey,
    I.Map<ChatTypes.MessageID, I.OrderedSet<ChatTypes.MessageKey>>
  >,
  messages: I.Map<ChatTypes.MessageKey, ChatTypes.Message>,
  pagination: PaginationState,
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
  conversationMessages: I.Map(),
  deletedIDs: I.Map(),
  devices: I.Map(),
  git: Git.makeState(),
  messageUpdates: I.Map(),
  messages: I.Map(),
  search: makeSearchSubState(),
  searchQueryToResult: I.Map(),
  searchResults: I.Map(),
  teams: Teams.makeState(),
  pagination: makePaginationState(),
})
