import * as Container from '../util/container'
import * as EngineGen from './engine-gen-gen'
import * as Constants from '../constants/deeplinks'

const initDeeplinks = () => {
  Container.listenAction(EngineGen.keybase1NotifyServiceHandleKeybaseLink, (_, action) => {
    const {link, deferred} = action.payload.params
    if (deferred && !link.startsWith('keybase://team-invite-link/')) {
      return
    }
    Constants.useState.getState().dispatch.handleKeybaseLink(link)
  })
}

export default initDeeplinks
