/* @flow */

import * as Constants from '../constants/pinentry'

import type {GUIEntryFeatures, GUIEntryArg} from '../constants/types/flow-types'
import type {PinentryActions, NewPinentryAction, RegisterPinentryListenerAction} from  '../constants/pinentry'

// TODO: have a root state that maps session id to pinentry popup

export type PinentryState = {
  closed: boolean,
  sessionID: number,
  features: GUIEntryFeatures,
  prompt: string,
  windowTitle: string,
  cancelled: boolean,
  submitted: boolean,
  submitLabel: ?string,
  cancelLabel: ?string,
  retryLabel: ?string
}

// Hack until flow allows disjoint unions by boolean types: https://github.com/facebook/flow/issues/577
export type RootPinentryState = {
  started: 1,
  pinentryStates: {
    [key: number]: PinentryState
  }
} | {
  started: 0
}

const intialState: RootPinentryState = {
  started: 0
}

export default function (state: RootPinentryState = intialState, action: PinentryActions): RootPinentryState {
  const sessionID: ?number = (action.payload && action.payload.sessionID != null) ? action.payload.sessionID : null
  switch (action.type) {
    case Constants.registerPinentryListener:
      if (action.payload && action.payload.started) {
        return {
          started: 1,
          pinentryStates: {}
        }
      }
      return {
        started: 0
      }
    case Constants.newPinentry:
      if (state.started === 1 && action.payload && sessionID != null) {
        const enabledFeatures = Object.keys(action.payload.features).filter(f => action.payload.features[f].allow).reduce((m, f) => {
          return {...m, f: action.payload.features[f]}
        }, {})
        const newPinentryState: PinentryState = {
          closed: false,
          cancelled: false,
          submitted: false,
          ...action.payload,
          features: enabledFeatures
        }
        return {
          ...state,
          pinentryStates: {
            [sessionID]: newPinentryState
          }
        }
      }
      return state
    default:
      if (state.started === 1 && sessionID != null) {
        return {
          ...state,
          pinentryStates: {
            [sessionID]: updatePinentryState(state.pinentryStates[sessionID] || {}, action)
          }
        }
      }
      return state
  }
}

function updatePinentryState (state: PinentryState, action: NewPinentryAction | RegisterPinentryListenerAction): PinentryState {
  switch (action.type) {
    case Constants.onCancel:
      return {...state, cancelled: true, closed: true}
    case Constants.onSubmit:
      return {...state, submitted: true, closed: true}
    default:
      return state
  }
}
