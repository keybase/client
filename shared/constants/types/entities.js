// @flow
import * as I from 'immutable'
import * as SearchTypes from './search'
import * as Git from './git'
import {type NoErrorTypedAction} from './flux'

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
  searchResults: I.Map<SearchTypes.SearchResultId, I.RecordOf<SearchTypes.SearchResult>>,
  searchQueryToResult: I.Map<SearchTypes.SearchQuery, I.List<SearchTypes.SearchResultId>>,
  searchKeyToResults: I.Map<string, ?I.List<SearchTypes.SearchResultId>>,
  searchKeyToPending: I.Map<string, boolean>,
  searchKeyToSelectedId: I.Map<string, ?SearchTypes.SearchResultId>,
  searchKeyToShowSearchSuggestion: I.Map<string, boolean>,
  searchKeyToUserInputItemIds: I.Map<string, I.OrderedSet<SearchTypes.SearchResultId>>,
  searchKeyToSearchResultQuery: I.Map<string, ?{text: string, service: SearchTypes.Service}>,
  searchKeyToClearSearchTextInput: I.Map<string, number>,
}
export type SearchSubState = I.RecordOf<_SearchSubState>

// State
export type _State = {
  git: Git.State,
  search: SearchSubState,
  searchQueryToResult: I.Map<SearchTypes.SearchQuery, I.List<SearchTypes.SearchResultId>>,
  searchResults: I.Map<SearchTypes.SearchResultId, SearchTypes.SearchResult>,
}

export type State = I.RecordOf<_State>
