// @flow
import * as I from 'immutable'
import * as SearchConstants from './search'
import * as Teams from './teams'
import * as Git from './git'
import * as ChatConstants from './chat'
import HiddenString from '../util/hidden-string'

import type {NoErrorTypedAction} from './types/flux'
import type {DeviceDetail} from './devices'

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

export type Actions = Delete | Merge | Replace

type _State = {
  devices: I.Map<string, DeviceDetail>,
  teams: Teams.State,
  searchResults: I.Map<SearchConstants.SearchResultId, I.RecordOf<SearchConstants.SearchResult>>,
  searchQueryToResult: I.Map<SearchConstants.SearchQuery, I.List<SearchConstants.SearchResultId>>,
  messages: I.Map<ChatConstants.MessageKey, ChatConstants.Message>,
  conversationMessages: I.Map<ChatConstants.ConversationIDKey, I.OrderedSet<ChatConstants.MessageKey>>,
  deletedIDs: I.Map<ChatConstants.ConversationIDKey, I.Set<ChatConstants.MessageID>>,
  messageUpdates: I.Map<
    ChatConstants.ConversationIDKey,
    I.Map<ChatConstants.MessageID, I.OrderedSet<ChatConstants.MessageKey>>
  >,
  convIDToSnippet: I.Map<ChatConstants.ConversationIDKey, ?HiddenString>,
  attachmentSavedPath: I.Map<ChatConstants.MessageKey, ?string>,
  attachmentDownloadedPath: I.Map<ChatConstants.MessageKey, ?string>,
  attachmentPreviewPath: I.Map<ChatConstants.MessageKey, ?string>,
  attachmentPreviewProgress: I.Map<ChatConstants.MessageKey, ?number>,
  attachmentDownloadProgress: I.Map<ChatConstants.MessageKey, ?number>,
  attachmentUploadProgress: I.Map<ChatConstants.MessageKey, ?number>,
  git: Git.State,
}

export type State = I.RecordOf<_State>
export const makeState: I.RecordFactory<_State> = I.Record({
  devices: I.Map(),
  git: Git.makeState(),
  teams: Teams.makeState(),
  searchResults: I.Map(),
  searchQueryToResult: I.Map(),
  messages: I.Map(),
  conversationMessages: I.Map(),
  deletedIDs: I.Map(),
  messageUpdates: I.Map(),
  convIDToSnippet: I.Map(),
  attachmentSavedPath: I.Map(),
  attachmentDownloadedPath: I.Map(),
  attachmentPreviewPath: I.Map(),
  attachmentPreviewProgress: I.Map(),
  attachmentDownloadProgress: I.Map(),
  attachmentUploadProgress: I.Map(),
})
