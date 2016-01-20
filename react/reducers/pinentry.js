/* @flow */

import * as Constants from '../constants/pinentry'

import type {Feature, GUIEntryFeatures} from '../constants/types/flow-types'
import type {PinentryActions} from '../constants/pinentry'

// TODO: have a root state that maps session id to pinentry popup

export type PinentryState = {
  closed: boolean,
  sessionID: number,
  features: GUIEntryFeatures,
  prompt: string,
  windowTitle: string,
  canceled: boolean,
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

type EnabledFeatures = {[key: string]: Feature}

const initialState: RootPinentryState = {
  started: 0
}

export default function (state: RootPinentryState = initialState, action: PinentryActions): RootPinentryState {
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
        const features = action.payload.features
        // Long form function to add annotation to help flow
        const reducer = function (m, f): EnabledFeatures {
          return {...m, [f]: features[f]}
        }
        const enabledFeatures = Object.keys(features).filter(f => features[f].allow).reduce(reducer, ({}: EnabledFeatures))

        const newPinentryState: PinentryState = {
          closed: false,
          canceled: false,
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

function updatePinentryState (state: PinentryState, action: PinentryActions): PinentryState {
  switch (action.type) {
    case Constants.onCancel:
      return {...state, canceled: true, closed: true}
    case Constants.onSubmit:
      return {...state, submitted: true, closed: true}
    default:
      return state
  }
}
