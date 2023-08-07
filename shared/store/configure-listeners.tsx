import initChat from '../actions/chat2'
import * as Z from '../util/zustand'

export const initListeners = () => {
  initChat()

  const f = async () => {
    const FS = await import('../constants/fs')
    FS.useState.getState().dispatch.setupSubscriptions()
    const Config = await import('../constants/config')
    Config.useConfigState.getState().dispatch.setupSubscriptions()
  }
  Z.ignorePromise(f())
}
