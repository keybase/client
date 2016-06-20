/* @flow */

import * as Constants from '../constants/pinentry'
import * as CommonConstants from '../constants/common'

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

export type RootPinentryState = {
  started: boolean,
  pinentryStates: {
    [key: number]: PinentryState
  }
}

type EnabledFeatures = {[key: string]: Feature}

const initialState: RootPinentryState = {
  started: false,
  pinentryStates: {},
}

export default function (state: RootPinentryState = initialState, action: PinentryActions): RootPinentryState {
  const sessionID: ?number = (action.payload && action.payload.sessionID != null) ? action.payload.sessionID : null
  switch (action.type) {
    case CommonConstants.resetStore:
      return {
        ...initialState,
        started: state.started,
      }
    case Constants.registerPinentryListener:
      if (action.payload && action.payload.started) {
        return {
          started: true,
          pinentryStates: {},
        }
      }
      return initialState
    case Constants.newPinentry:
      if (state.started && action.payload && sessionID != null) {
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
          features: enabledFeatures,
        }
        return {
          ...state,
          pinentryStates: {
            ...state.pinentryStates,
            [sessionID]: newPinentryState,
          },
        }
      }
      return state
    default:
      if (state.started && sessionID != null && isPinentryAction(action)) {
        return {
          ...state,
          pinentryStates: {
            ...state.pinentryStates,
            [sessionID]: updatePinentryState(state.pinentryStates[sessionID] || {}, action),
          },
        }
      }
      return state
  }
}

function isPinentryAction (action: Object | PinentryActions): boolean {
  switch (action.type) {
    case Constants.onCancel:
    case Constants.onSubmit:
      return true
    default:
      return false
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
