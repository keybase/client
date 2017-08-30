// @flow
import {Map, Record, List, Set} from 'immutable'
import * as SearchConstants from './search'
import * as Teams from './teams'
import * as ChatConstants from './chat'
import HiddenString from '../util/hidden-string'

import type {KBRecord, KBOrderedSet} from './types/more'
import type {NoErrorTypedAction} from './types/flux'
import type {DeviceDetailRecord} from './devices'

export type EntityType = any // TODO stronger typing?

// Actions
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

// State
export type State = KBRecord<{
  devices: Map<string, DeviceDetailRecord>,
  teams: Teams.TeamRecord,
  searchResults: Map<SearchConstants.SearchResultId, KBRecord<SearchConstants.SearchResult>>,
  searchQueryToResult: Map<SearchConstants.SearchQuery, List<SearchConstants.SearchResultId>>,
  messages: Map<ChatConstants.MessageKey, ChatConstants.Message>,
  conversationMessages: Map<ChatConstants.ConversationIDKey, KBOrderedSet<ChatConstants.MessageKey>>,
  deletedIDs: Map<ChatConstants.ConversationIDKey, Set<ChatConstants.MessageID>>,
  messageUpdates: Map<
    ChatConstants.ConversationIDKey,
    Map<ChatConstants.MessageID, KBOrderedSet<ChatConstants.MessageKey>>
  >,
  convIDToSnippet: Map<ChatConstants.ConversationIDKey, ?HiddenString>,
  attachmentSavedPath: Map<ChatConstants.MessageKey, ?string>,
  attachmentDownloadedPath: Map<ChatConstants.MessageKey, ?string>,
  attachmentPreviewPath: Map<ChatConstants.MessageKey, ?string>,
  attachmentPreviewProgress: Map<ChatConstants.MessageKey, ?number>,
  attachmentDownloadProgress: Map<ChatConstants.MessageKey, ?number>,
  attachmentUploadProgress: Map<ChatConstants.MessageKey, ?number>,
}>

const StateRecord = Record({
  devices: Map(),
  teams: new Teams.Team(),
  searchResults: Map(),
  searchQueryToResult: Map(),
  messages: Map(),
  conversationMessages: Map(),
  deletedIDs: Map(),
  messageUpdates: Map(),
  convIDToSnippet: Map(),
  attachmentSavedPath: Map(),
  attachmentDownloadedPath: Map(),
  attachmentPreviewPath: Map(),
  attachmentPreviewProgress: Map(),
  attachmentDownloadProgress: Map(),
  attachmentUploadProgress: Map(),
})

export {StateRecord}
