// @flow

import type {State as GregorState, Item, Metadata, OutOfBandMessage} from '../constants/types/flow-types-gregor'
import type {PushReason} from '../constants/types/flow-types'
import type {TypedAction} from '../constants/types/flux'

export const pushState = 'gregor:pushState'
export type PushState = TypedAction<'gregor:pushState', {state: GregorState, reason: PushReason}, void>

export const pushOOBM = 'gregor:pushOOBM'
export type PushOOBM = TypedAction<'gregor:pushOOBM', {messages: Array<OutOfBandMessage>}, void>

export const updateSeenMsgs = 'gregor:updateSeenMsgs'
export type UpdateSeenMsgs = TypedAction<'gregor:updateSeenMsgs', {seenMsgs: Array<NonNullGregorItem>}, void>

export type GregorActions = PushState | UpdateSeenMsgs

export type NonNullGregorItem = {
  md: Metadata,
  item: Item,
}

export type MsgMap = {[key: string]: NonNullGregorItem}
