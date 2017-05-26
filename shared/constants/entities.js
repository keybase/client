// @flow
import {Map, Record} from 'immutable'

import type {NoErrorTypedAction} from './types/flux'
import type {DeviceDetailRecord} from './devices'
import type {State as SearchState} from './searchv3'

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
export type State = Record<{
  devices: Map<string, DeviceDetailRecord>,
  searchv3Chat: Map<string, SearchState>,
  searchv3Profile: Map<string, SearchState>,
}>

const StateRecord = Record({
  devices: Map(),
  searchv3Chat: Map(),
  searchv3Profile: Map(),
})

export {StateRecord}
