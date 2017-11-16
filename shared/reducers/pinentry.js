// @flow
import * as Types from '../constants/types/pinentry'
import * as Constants from '../constants/pinentry'
import * as PinentryGen from '../actions/pinentry-gen'

export default function(
  state: Types.State = Constants.initialState,
  action: PinentryGen.Actions
): Types.State {
  switch (action.type) {
    case PinentryGen.resetStore:
      return {
        ...Constants.initialState,
      }
    case PinentryGen.newPinentry:
      const {sessionID} = action.payload
      if (state.started && sessionID != null) {
        const {features} = action.payload
        // Long form function to add annotation to help flow
        const reducer = function(m: Types.EnabledFeatures, f: string): Types.EnabledFeatures {
          return {...m, [f]: features[f]}
        }
        // $FlowIssue
        const enabledFeatures: RPCTypes.GUIEntryFeatures = Object.keys(features)
          .filter((f: string) => features[f].allow)
          .reduce(reducer, ({}: Types.EnabledFeatures))

        const newPinentryState: Types.PinentryState = {
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
      return state
    }
    default:
      // eslint-disable-next-line no-unused-expressions
      (action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}
