// @flow
import * as Constants from '../constants/pinentry'
import * as CommonConstants from '../constants/common'

// TODO: have a root state that maps session id to pinentry popup

const initialState: Constants.State = {
  pinentryStates: {},
  started: false,
}

export default function(
  state: Constants.State = initialState,
  action: Constants.Actions
): Constants.State {
  const sessionID: ?number = action.payload && action.payload.sessionID != null
    ? action.payload.sessionID
    : null
  switch (action.type) {
    case CommonConstants.resetStore:
      return {
        ...initialState,
        started: state.started,
      }
    case Constants.registerPinentryListener:
      if (action.payload && action.payload.started) {
        return {
          pinentryStates: {},
          started: true,
        }
      }
      return initialState
    case Constants.newPinentry:
      if (state.started && action.payload && sessionID != null) {
        const features = action.payload.features
        // Long form function to add annotation to help flow
        const reducer = function(
          m: Constants.EnabledFeatures,
          f: string
        ): Constants.EnabledFeatures {
          return {...m, [f]: features[f]}
        }
        const enabledFeatures = Object.keys(features)
          .filter((f: string) => features[f].allow)
          .reduce(reducer, ({}: Constants.EnabledFeatures))

        const newPinentryState: Constants.PinentryState = {
          canceled: false,
          closed: false,
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
            [sessionID]: updatePinentryState(
              state.pinentryStates[sessionID + ''] || {},
              action
            ),
          },
        }
      }
      return state
  }
}

function isPinentryAction(action: Object | Constants.Actions): boolean {
  switch (action.type) {
    case Constants.onCancel:
    case Constants.onSubmit:
      return true
    default:
      return false
  }
}

function updatePinentryState(
  state: Constants.PinentryState,
  action: Constants.Actions
): Constants.PinentryState {
  switch (action.type) {
    case Constants.onCancel:
      return {...state, canceled: true, closed: true}
    case Constants.onSubmit:
      return {...state, closed: true, submitted: true}
    default:
      return state
  }
}
