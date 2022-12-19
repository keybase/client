import type * as Types from '../constants/types/pinentry'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as PinentryGen from '../actions/pinentry-gen'
import * as Container from '../util/container'

const initialState: Types.State = {
  prompt: '',
  type: RPCTypes.PassphraseType.none,
  windowTitle: '',
}

export default Container.makeReducer<PinentryGen.Actions, Types.State>(initialState, {
  [PinentryGen.resetStore]: () => initialState,
  [PinentryGen.close]: () => initialState,
  [PinentryGen.newPinentry]: (draftState, action) => {
    draftState.cancelLabel = action.payload.cancelLabel
    draftState.prompt = action.payload.prompt
    draftState.retryLabel = action.payload.retryLabel
    draftState.showTyping = action.payload.showTyping
    draftState.submitLabel = action.payload.submitLabel
    draftState.type = action.payload.type
    draftState.windowTitle = action.payload.windowTitle
  },
})
