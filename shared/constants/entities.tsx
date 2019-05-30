import * as I from 'immutable'
import * as Teams from './teams'
import * as Git from './git'
import * as Types from './types/entities'

const makeSearchSubState = I.Record<Types._SearchSubState>({
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

export const makeState = I.Record<Types._State>({
  git: Git.makeState(),
  search: makeSearchSubState(),
  searchQueryToResult: I.Map(),
  searchResults: I.Map(),
})
