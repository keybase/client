// @flow
import {Set, List, Map, Record} from 'immutable'

import type {NoErrorTypedAction} from './types/flux'
import type {DeviceDetailRecord} from './devices'

type EntityTypes = 'devices'
type EntityType = any // TODO stronger typing?

// Actions
type Delete = NoErrorTypedAction<'entity:delete', {keyPath: Array<string>, ids: Array<string>}>
type Merge = NoErrorTypedAction<'entity:merge', {keyPath: Array<string>, entities: {[id: string]: EntityType}}>
type Replace = NoErrorTypedAction<'entity:replace', {keyPath: Array<string>, entities: {[id: string]: EntityType}}>

type Actions = Delete
  | Merge
  | Replace

// State
type State = Record<{
  devices: Map<string, DeviceDetailRecord>,
}>

const StateRecord = Record({
  devices: Map(),
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
