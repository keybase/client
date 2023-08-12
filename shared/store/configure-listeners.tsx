import initChat from '../actions/chat2'
import * as C from '../constants'
import * as Config from '../constants/config'

export const initListeners = () => {
  initChat()
  C.useFSState.getState().dispatch.setupSubscriptions()
  Config.useConfigState.getState().dispatch.setupSubscriptions()
}
