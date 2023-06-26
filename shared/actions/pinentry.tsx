import logger from '../logger'
import * as ConfigConstants from '../constants/config'
import * as EngineGen from './engine-gen-gen'
import * as PinentryGen from './pinentry-gen'
import * as Container from '../util/container'
import * as Constants from '../constants/pinentry'
import * as RPCTypes from '../constants/types/rpc-gen'
import {getEngine} from '../engine/require'

const initPinentry = () => {
  getEngine().registerCustomResponse('keybase.1.secretUi.getPassphrase')
  Container.listenAction(EngineGen.keybase1SecretUiGetPassphrase, (_, action) => {
    const {response, params} = action.payload
    const {pinentry} = params
    const {prompt, submitLabel, cancelLabel, windowTitle, features, type} = pinentry
    let {retryLabel} = pinentry
    if (retryLabel === ConfigConstants.invalidPasswordErrorString) {
      retryLabel = 'Incorrect password.'
    }
    Constants.useState().dispatch.onGetPassword({
      cancelLabel,
      prompt,
      response,
      retryLabel,
      showTyping: features.showTyping,
      submitLabel,
      type,
      windowTitle,
    })
  })
  Container.listenAction(EngineGen.connected, async () => {
    try {
      await RPCTypes.delegateUiCtlRegisterSecretUIRpcPromise()
      logger.info('Registered secret ui')
    } catch (error) {
      logger.warn('error in registering secret ui: ', error)
    }
  })
  Container.listenAction(PinentryGen.onCancel, () => {
    Constants.useState().dispatch.onCancel()
  })
  Container.listenAction(PinentryGen.onSubmit, (_, action) => {
    Constants.useState().dispatch.onSubmit(action.payload.password)
  })
}

export default initPinentry
