import * as EngineGen from './engine-gen-gen'
import * as Container from '../util/container'
import * as Constants from '../constants/pinentry'
import {getEngine} from '../engine/require'

const initPinentry = () => {
  getEngine().registerCustomResponse('keybase.1.secretUi.getPassphrase')

  Container.listenAction(EngineGen.keybase1SecretUiGetPassphrase, (_, action) => {
    const {response, params} = action.payload
    const {pinentry} = params
    Constants.useState.getState().dispatch.secretUIWantsPassphrase(pinentry, response)
  })
}

export default initPinentry
