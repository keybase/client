import initChat from '../actions/chat2'
import * as Z from '../util/zustand'
import * as FS from '../constants/fs'
import * as Config from '../constants/config'

export const initListeners = () => {
  initChat()

  const f = async () => {
    FS.useState.getState().dispatch.setupSubscriptions()
    Config.useConfigState.getState().dispatch.setupSubscriptions()
  }
  Z.ignorePromise(f())
}
