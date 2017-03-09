// @flow
import {Set, List, Map, Record} from 'immutable'

import type {NoErrorTypedAction} from './types/flux'
import type {SearchResult} from './search'

type EntityTypes = 'search'
type EntityType = any // TODO stronger typing?

// Actions
type Delete = NoErrorTypedAction<'entity:delete', {keyPath: Array<string>, ids: Array<string>}>
type Merge = NoErrorTypedAction<'entity:merge', {keyPath: Array<string>, entities: {[id: string]: EntityType}}>
type Replace = NoErrorTypedAction<'entity:replace', {keyPath: Array<string>, entities: {[id: string]: EntityType}}>

type Actions = Delete
  | Merge
  | Replace

// State
type SearchEntities = Record<{
  results: Map<string, SearchResult>,
}>

const SearchEntitiesRecord = Record({
  results: Map(),
})

type State = Record<{
  search: SearchEntities,
}>

const StateRecord = Record({
  search: new SearchEntitiesRecord(),
})

export type {
  Actions,
  State,
  Merge,
  Replace,
}

export {
  StateRecord,
}
