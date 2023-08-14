import * as C from '../constants'
import initChat from '../actions/chat2'

export const initListeners = () => {
  initChat()
  C.useFSState.getState().dispatch.setupSubscriptions()
  C.useConfigState.getState().dispatch.setupSubscriptions()
}
