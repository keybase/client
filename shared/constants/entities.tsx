import * as I from 'immutable'
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

export const makeState = I.Record<Types._State>({
  search: makeSearchSubState(),
  searchQueryToResult: I.Map(),
  searchResults: I.Map(),
})
