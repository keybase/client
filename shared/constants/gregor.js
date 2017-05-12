// @flow

import type {
  State as GregorState,
  Item,
  Metadata,
  OutOfBandMessage,
} from '../constants/types/flow-types-gregor'
import type {PushReason, Reachability} from '../constants/types/flow-types'
import type {TypedAction} from '../constants/types/flux'

export type NonNullGregorItem = {
  md: Metadata,
  item: Item,
}

export type MsgMap = {[key: string]: NonNullGregorItem}
export const pushState = 'gregor:pushState'
export type PushState = TypedAction<
  'gregor:pushState',
  {state: GregorState, reason: PushReason},
  void
>

export const pushOOBM = 'gregor:pushOOBM'
export type PushOOBM = TypedAction<
  'gregor:pushOOBM',
  {messages: Array<OutOfBandMessage>},
  void
>

export const updateReachability = 'gregor:updateReachability'
export type UpdateReachability = TypedAction<
  'gregor:updateReachability',
  {reachability: Reachability},
  void
>

export const checkReachability = 'gregor:checkReachability'
export type CheckReachability = TypedAction<
  'gregor:checkReachability',
  void,
  void
>

export const updateSeenMsgs = 'gregor:updateSeenMsgs'
export type UpdateSeenMsgs = TypedAction<
  'gregor:updateSeenMsgs',
  {seenMsgs: Array<NonNullGregorItem>},
  void
>

export type GregorActions = PushState | UpdateSeenMsgs

export type State = {
  reachability: Reachability,
  seenMsgs: MsgMap,
}
