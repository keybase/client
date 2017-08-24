// @flow
import {Map, Record, List} from 'immutable'
import * as SearchConstants from './search'

import type {KBRecord} from './types/more'
import type {NoErrorTypedAction} from './types/flux'
import type {DeviceDetailRecord} from './devices'
import type {Teamname, TeamRecord} from './teams'

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
export type State = KBRecord<{
  devices: Map<string, DeviceDetailRecord>,
  teams: Map<Teamname, TeamRecord>,
  searchResults: Map<SearchConstants.SearchResultId, KBRecord<SearchConstants.SearchResult>>,
  searchQueryToResult: Map<SearchConstants.SearchQuery, List<SearchConstants.SearchResultId>>,
}>

const StateRecord = Record({
  devices: Map(),
  teams: Map(),
  searchResults: Map(),
  searchQueryToResult: Map(),
})

export {StateRecord}
