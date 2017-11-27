// @flow
import * as Types from '../constants/types/pinentry'
import * as Constants from '../constants/pinentry'
import * as PinentryGen from '../actions/pinentry-gen'

const initialState: Types.State = Constants.makeState()

export default function(state: Types.State = initialState, action: PinentryGen.Actions): Types.State {
  switch (action.type) {
    case PinentryGen.resetStore:
      return initialState
    case PinentryGen.deleteEntity: {
      const {keyPath, ids} = action.payload
      // $FlowIssue flow can't guarantee the keypath works for all cases
      return state.updateIn(keyPath, map => map.deleteAll(ids))
    }
    case PinentryGen.mergeEntity: {
      const {keyPath, entities} = action.payload
      return state.mergeDeepIn(keyPath, entities)
    }
    case PinentryGen.replaceEntity: {
      const {keyPath, entities} = action.payload
      return state.mergeIn(keyPath, entities)
    }
    case PinentryGen.subtractEntity: {
      const {keyPath, entities} = action.payload
      // $FlowIssue flow can't guarantee the keypath works for all cases
      return state.updateIn(keyPath, set => set.subtract(entities))
    }
    // Saga only actions
    case PinentryGen.newPinentry:
    case PinentryGen.onCancel:
    case PinentryGen.onSubmit:
      return state
    // case PinentryGen.newPinentry:
    // const {sessionID} = action.payload
    // const {features} = action.payload
    // // Long form function to add annotation to help flow
    // const reducer = function(m: Types.EnabledFeatures, f: string): Types.EnabledFeatures {
    // return {...m, [f]: features[f]}
    // }
    // // $FlowIssue
    // const enabledFeatures: RPCTypes.GUIEntryFeatures = Object.keys(features)
    // .filter((f: string) => features[f].allow)
    // .reduce(reducer, ({}: Types.EnabledFeatures))

    // const newPinentryState: Types.PinentryState = {
    // canceled: false,
    // closed: false,
    // submitted: false,
    // ...action.payload,
    // features: enabledFeatures,
    // }
    // return {
    // ...state,
    // pinentryStates: {
    // ...state.pinentryStates,
    // [sessionID]: newPinentryState,
    // },
    // }
    // case PinentryGen.onCancel: // fallthrough
    // case PinentryGen.onSubmit: {
    // const {sessionID} = action.payload
    // const nextState = {
    // ...(state.pinentryStates[sessionID + ''] || {}),
    // ...(action.type === PinentryGen.onCancel
    // ? {canceled: true, closed: true}
    // : {closed: true, submitted: true}),
    // }
    // return {
    // ...state,
    // pinentryStates: {
    // ...state.pinentryStates,
    // [sessionID]: nextState,
    // },
    // }
    // }
    default:
      // eslint-disable-next-line no-unused-expressions
      (action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}
