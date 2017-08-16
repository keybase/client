// @flow
import {Map, Record, List, OrderedSet} from 'immutable'
import * as SearchConstants from './search'

import type {KBRecord} from './types/more'
import type {NoErrorTypedAction} from './types/flux'
import type {DeviceDetailRecord} from './devices'

export type EntityType = any // TODO stronger typing?

// Actions
export type Delete = NoErrorTypedAction<'entity:delete', {keyPath: Array<string>, ids: Array<string>}>
export type Merge = NoErrorTypedAction<
  'entity:merge',
  {keyPath: Array<string>, entities: {[id: string]: EntityType}}
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

// State
export type State = KBRecord<{
  devices: Map<string, DeviceDetailRecord>,
  searchResults: Map<SearchConstants.SearchResultId, KBRecord<SearchConstants.SearchResult>>,
  searchQueryToResult: Map<SearchConstants.SearchQuery, List<SearchConstants.SearchResultId>>,
  searchKeyToResults: Map<string, ?List<SearchConstants.SearchResultId>>,
  searchKeyToPending: Map<string, boolean>,
  searchKeyToSelectedId: Map<string, ?SearchConstants.SearchResultId>,
  searchKeyToShowSearchSuggestion: Map<string, boolean>,
  searchKeyToUserInputItemIds: Map<string, OrderedSet<SearchConstants.SearchResultId>>,
  searchKeyToSearchResultQuery: Map<string, ?{text: string, service: SearchConstants.Service}>,
  searchKeyToClearSearchInput: Map<string, number>,
}>

const StateRecord = Record({
  devices: Map(),
  searchResults: Map(),
  searchQueryToResult: Map(),
  searchKeyToResults: Map(),
  searchKeyToPending: Map(),
  searchKeyToSelectedId: Map(),
  searchKeyToShowSearchSuggestion: Map(),
  searchKeyToUserInputItemIds: Map(),
  searchKeyToSearchResultQuery: Map(),
  searchKeyToClearSearchInput: Map(),
})

export {StateRecord}
