// @flow
import {Map, Record, List} from 'immutable'
import * as SearchConstants from './searchv3'

import type {LooseRecord} from './types/more'
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

export type Actions = Delete | Merge | Replace

// State
export type State = LooseRecord<{
  devices: Map<string, DeviceDetailRecord>,
  searchResults: Map<SearchConstants.SearchResultId, SearchConstants.SearchResult>,
  searchQueryToResult: Map<SearchConstants.SearchQuery, List<SearchConstants.SearchResultId>>,
}>

const StateRecord = Record({
  devices: Map(),
  searchResults: Map(),
  searchQueryToResult: Map(),
})

export {StateRecord}
