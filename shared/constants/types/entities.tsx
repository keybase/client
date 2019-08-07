import * as I from 'immutable'
import * as SearchTypes from './search'

export type _SearchSubState = {
  searchResults: I.Map<SearchTypes.SearchResultId, I.RecordOf<SearchTypes.SearchResult>>
  searchQueryToResult: I.Map<SearchTypes.SearchQuery, I.List<SearchTypes.SearchResultId>>
  searchKeyToResults: I.Map<string, I.List<SearchTypes.SearchResultId> | null>
  searchKeyToPending: I.Map<string, boolean>
  searchKeyToSelectedId: I.Map<string, SearchTypes.SearchResultId | null>
  searchKeyToShowSearchSuggestion: I.Map<string, boolean>
  searchKeyToUserInputItemIds: I.Map<string, I.OrderedSet<SearchTypes.SearchResultId>>
  searchKeyToSearchResultQuery: I.Map<
    string,
    {
      text: string
      service: SearchTypes.Service
    } | null
  >
  searchKeyToClearSearchTextInput: I.Map<string, number>
}
export type SearchSubState = I.RecordOf<_SearchSubState>

// State
export type _State = {
  search: SearchSubState
  searchQueryToResult: I.Map<SearchTypes.SearchQuery, I.List<SearchTypes.SearchResultId>>
  searchResults: I.Map<SearchTypes.SearchResultId, SearchTypes.SearchResult>
}

export type State = I.RecordOf<_State>
