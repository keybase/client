import initChat from '../actions/chat2'
import * as FS from '../constants/fs'
import * as Config from '../constants/config'

export const initListeners = () => {
  initChat()
  FS.useState.getState().dispatch.setupSubscriptions()
  Config.useConfigState.getState().dispatch.setupSubscriptions()
}
