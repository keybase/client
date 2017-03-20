// @flow
import {Map, Record} from 'immutable'

import type {NoErrorTypedAction} from './types/flux'
import type {DeviceDetailRecord as Device} from './devices'
import type {InboxEntity as ChatInbox} from './chat'

export type EntityType = any // TODO stronger typing?

// Actions
export type Delete = NoErrorTypedAction<'entity:delete', {keyPath: Array<string>, ids: Array<string>}>
export type DeleteAll = NoErrorTypedAction<'entity:deleteAll', {keyPath: Array<string>}>
export type Merge = NoErrorTypedAction<'entity:merge', {keyPath: Array<string>, entities: {[id: string]: EntityType}}>
export type Replace = NoErrorTypedAction<'entity:replace', {keyPath: Array<string>, entities: {[id: string]: EntityType}}>

export type Actions = Delete
  | DeleteAll
  | Merge
  | Replace

// State
export type State = Record<{
  chatInbox: Map<string, ChatInbox>,
  devices: Map<string, Device>,
}>

const StateRecord = Record({
  chatInbox: Map(),
  devices: Map(),
})

export {
  StateRecord,
}
