// @flow
import * as I from 'immutable'
import * as Teams from '../teams'
import * as ChatTypes from './chat'
import * as SearchConstants from '../search'
import * as Git from '../git'
import {type NoErrorTypedAction} from './flux'
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

export type _SearchSubState = {
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
export type SearchSubState = I.RecordOf<_SearchSubState>

export type PaginationState = I.RecordOf<{
  next: I.Map<ChatTypes.ConversationIDKey, string>, // Pass this when we want to get older messages
  prev: I.Map<ChatTypes.ConversationIDKey, string>, // For when we want to get newer messages
}>

// State
export type _State = {
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
