// @flow

import type {State as GregorState} from '../constants/types/flow-types-gregor'
import type {PushReason} from '../constants/types/flow-types'
import type {TypedAction} from '../constants/types/flux'

export const pushState = 'gregor:pushState'
export type PushState = TypedAction<'gregor:pushState', {state: GregorState, reason: PushReason}, {}>

export type GregorActions = PushState
