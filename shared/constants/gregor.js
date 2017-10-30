// @flow
import type {Item, Metadata, OutOfBandMessage} from '../constants/types/flow-types-gregor'
import type {Reachability} from '../constants/types/flow-types'
import type {TypedAction, NoErrorTypedAction} from '../constants/types/flux'

export type NonNullGregorItem = {
  md: Metadata,
  item: Item,
}

export type MsgMap = {[key: string]: ?NonNullGregorItem}

export const pushOOBM = 'gregor:pushOOBM'
export type PushOOBM = NoErrorTypedAction<'gregor:pushOOBM', {messages: Array<OutOfBandMessage>}>

export const updateReachability = 'gregor:updateReachability'
export type UpdateReachability = NoErrorTypedAction<'gregor:updateReachability', {reachability: Reachability}>

export const checkReachability = 'gregor:checkReachability'
export type CheckReachability = NoErrorTypedAction<'gregor:checkReachability', void>

export const updateSeenMsgs = 'gregor:updateSeenMsgs'
export type UpdateSeenMsgs = NoErrorTypedAction<'gregor:updateSeenMsgs', {seenMsgs: Array<NonNullGregorItem>}>

export const injectItem = 'gregor:injectItem'
export type InjectItem = NoErrorTypedAction<
  'gregor:injectItem',
  {category: string, body: string, dtime?: ?Date}
>

export type GregorActions = UpdateSeenMsgs

export type State = {
  reachability: Reachability,
  seenMsgs: MsgMap,
}
