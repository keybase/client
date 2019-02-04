// @flow
import * as I from 'immutable'
import * as Teams from './teams'
import * as Git from './git'
import * as Types from './types/entities'

const makeSearchSubState: I.RecordFactory<Types._SearchSubState> = I.Record({
  searchKeyToClearSearchTextInput: I.Map(),
  searchKeyToPending: I.Map(),
  searchKeyToResults: I.Map(),
  searchKeyToSearchResultQuery: I.Map(),
  searchKeyToSelectedId: I.Map(),
  searchKeyToShowSearchSuggestion: I.Map(),
  searchKeyToUserInputItemIds: I.Map(),
  searchQueryToResult: I.Map(),
  searchResults: I.Map(),
})

const makePaginationState = I.Record({
  next: I.Map(),
  prev: I.Map(),
})

export const makeState: I.RecordFactory<Types._State> = I.Record({
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
  pagination: makePaginationState(),
  search: makeSearchSubState(),
  searchQueryToResult: I.Map(),
  searchResults: I.Map(),
  teams: Teams.makeState(),
})
