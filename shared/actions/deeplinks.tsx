import * as Container from '../util/container'
import * as DeeplinksGen from './deeplinks-gen'
import * as EngineGen from './engine-gen-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as Tabs from '../constants/tabs'
import * as CrytoConstants from '../constants/crypto'
import * as Constants from '../constants/deeplinks'
import * as ConfigConstants from '../constants/config'
import * as ConfigGen from './config-gen'
import type * as CryptoTypes from '../constants/types/crypto'
import logger from '../logger'

const initDeeplinks = () => {
  Container.listenAction(ConfigGen.resetStore, () => {
    Constants.useState.getState().dispatch.resetState()
  })
  Container.listenAction(DeeplinksGen.link, (_, action) => {
    Constants.useState.getState().dispatch.handleAppLink(action.payload.link)
  })
  Container.listenAction(EngineGen.keybase1NotifyServiceHandleKeybaseLink, (_, action) => {
    const {link, deferred} = action.payload.params
    if (deferred && !link.startsWith('keybase://team-invite-link/')) {
      return
    }
    Constants.useState.getState().dispatch.handleKeybaseLink(link)
  })
  Container.listenAction(DeeplinksGen.saltpackFileOpen, (_, action) => {
    const {path: _path} = action.payload
    const path = typeof _path === 'string' ? _path : _path.stringValue()

    if (!ConfigConstants.useConfigState.getState().loggedIn) {
      console.warn('Tried to open a saltpack file before being logged in')
      return
    }
    let operation: CryptoTypes.Operations | undefined
    if (CrytoConstants.isPathSaltpackEncrypted(path)) {
      operation = CrytoConstants.Operations.Decrypt
    } else if (CrytoConstants.isPathSaltpackSigned(path)) {
      operation = CrytoConstants.Operations.Verify
    } else {
      logger.warn(
        'Deeplink received saltpack file path not ending in ".encrypted.saltpack" or ".signed.saltpack"'
      )
      return
    }
    const {onSaltpackOpenFile} = CrytoConstants.useState.getState().dispatch
    onSaltpackOpenFile(operation, path)
    return RouteTreeGen.createSwitchTab({tab: Tabs.cryptoTab})
  })
}

export default initDeeplinks
