// @flow
/* eslint-disable */
import * as Constants from '../constants/gregor'
import * as RPCTypes from '../constants/types/flow-types'
import * as GregorTypes from '../constants/types/flow-types-gregor'

type _ExtractReturn<B, F: (...args: any[]) => B> = B
export type ReturnType<F> = _ExtractReturn<*, F>
export type PayloadType<F> = $PropertyType<ReturnType<F>, 'payload'>

// Constants
export const pushState = 'gregor:pushState'

// Action Creators
export const createPushState = (payload: {|state: GregorTypes.State, reason: RPCTypes.PushReason|}) => ({
  type: pushState,
  error: false,
  payload,
})

// All Actions
export type Actions = ReturnType<typeof createPushState>
