// @flow
import * as Constants from '../constants/pinentry'
import * as PinentryGen from '../actions/pinentry-gen'

export default function(
  state: Constants.State = Constants.initialState,
  action: PinentryGen.Actions
): Constants.State {
  switch (action.type) {
    case PinentryGen.resetStore:
      return {
        ...Constants.initialState,
        started: state.started,
      }
    case PinentryGen.registerPinentryListener:
      const {started} = action.payload
      if (started) {
        return {
          pinentryStates: {},
          started: true,
        }
      }
      return Constants.initialState
    case PinentryGen.newPinentry:
      const {sessionID} = action.payload
      if (state.started && sessionID != null) {
        const {features} = action.payload
        // Long form function to add annotation to help flow
        const reducer = function(m: Constants.EnabledFeatures, f: string): Constants.EnabledFeatures {
          return {...m, [f]: features[f]}
        }
        // $FlowIssue
        const enabledFeatures: RPCTypes.GUIEntryFeatures = Object.keys(features)
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
      break
    case PinentryGen.onCancel: // fallthrough
    case PinentryGen.onSubmit: {
      const {sessionID} = action.payload
      if (state.started && sessionID != null) {
        const nextState = {
          ...(state.pinentryStates[sessionID + ''] || {}),
          ...(action.type === PinentryGen.onCancel
            ? {canceled: true, closed: true}
            : {closed: true, submitted: true}),
        }
        return {
          ...state,
          pinentryStates: {
            ...state.pinentryStates,
            [sessionID]: nextState,
          },
        }
      }
      break
    }
  }

  return state
}
