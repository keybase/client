// @flow
import * as Constants from '../../constants/profile'
import * as Saga from 'redux-saga/effects'
import * as RPCTypes from '../../constants/types/flow-types'
import engine, {Engine} from '../../engine'
import {navigateTo, navigateAppend} from '../route-tree'
import {peopleTab} from '../../constants/tabs'
import {safeTakeEvery} from '../../util/saga'

import type {NavigateTo} from '../../constants/route-tree'
import type {PlatformsExpandedType, ProvablePlatformsType} from '../../constants/types/more'
import type {SagaGenerator} from '../../constants/types/saga'
import type {TypedState} from '../../constants/reducer'

function _updatePlatform(platform: PlatformsExpandedType): Constants.UpdatePlatform {
  return {payload: {platform}, type: Constants.updatePlatform}
}

function _askTextOrDNS(): NavigateTo {
  return navigateTo(['proveWebsiteChoice'], [peopleTab])
}

function _registerBTC(): NavigateTo {
  return navigateTo(['proveEnterUsername'], [peopleTab])
}

function _registerZcash(): NavigateTo {
  return navigateTo(['proveEnterUsername'], [peopleTab])
}

function addProof(platform: PlatformsExpandedType): Constants.AddProof {
  return {payload: {platform}, type: Constants.addProof}
}

function _cleanupUsername(): Constants.CleanupUsername {
  return {payload: undefined, type: Constants.cleanupUsername}
}

function submitUsername(): Constants.SubmitUsername {
  return {payload: undefined, type: Constants.submitUsername}
}

function cancelAddProof(): Constants.CancelAddProof {
  return {payload: undefined, type: Constants.cancelAddProof}
}

function submitBTCAddress(): Constants.SubmitBTCAddress {
  return {payload: undefined, type: Constants.submitBTCAddress}
}

function submitZcashAddress(): Constants.SubmitZcashAddress {
  return {payload: undefined, type: Constants.submitZcashAddress}
}

function _updateProofText(proof: string): Constants.UpdateProofText {
  return {payload: {proof}, type: Constants.updateProofText}
}

function _updateProofStatus(found, status): Constants.UpdateProofStatus {
  return {payload: {found, status}, type: Constants.updateProofStatus}
}

function _waitingForResponse(waiting: boolean): Constants.Waiting {
  return {payload: {waiting}, type: Constants.waiting}
}

function _updateErrorText(errorText: ?string, errorCode: ?number): Constants.UpdateErrorText {
  return {payload: {errorText, errorCode}, type: Constants.updateErrorText}
}

function _updateSigID(sigID: ?RPCTypes.SigID): Constants.UpdateSigID {
  return {payload: {sigID}, type: Constants.updateSigID}
}

function checkProof(): Constants.CheckProof {
  return {payload: undefined, type: Constants.checkProof}
}

function* _checkProof(action: Constants.CheckProof): SagaGenerator<any, any> {
  const getSigID = (state: TypedState) => state.profile.sigID
  const sigID = (yield Saga.select(getSigID): any)
  if (!sigID) {
    return
  }

  yield Saga.put(_updateErrorText(null))

  try {
    yield Saga.put(_waitingForResponse(true))
    const {found, status} = yield Saga.call(RPCTypes.proveCheckProofRpcPromise, {param: {sigID}})
    yield Saga.put(_waitingForResponse(false))

    // Values higher than baseHardError are hard errors, below are soft errors (could eventually be resolved by doing nothing)
    if (!found && status >= RPCTypes.proveCommonProofStatus.baseHardError) {
      yield Saga.put(_updateErrorText("We couldn't find your proof. Please retry!"))
    } else {
      yield Saga.put(_updateProofStatus(found, status))
      yield Saga.put(navigateAppend(['confirmOrPending'], [peopleTab]))
    }
  } catch (error) {
    yield Saga.put(_waitingForResponse(false))
    console.warn('Error getting proof update')
    yield Saga.put(_updateErrorText("We couldn't verify your proof. Please retry!"))
  }
}

function* _addProof(action: Constants.AddProof): SagaGenerator<any, any> {
  yield Saga.put(_updatePlatform(action.payload.platform))
  yield Saga.put(_updateErrorText())

  // Special cases
  switch (action.payload.platform) {
    case 'dnsOrGenericWebSite':
      yield Saga.put(_askTextOrDNS())
      break
    case 'zcash':
      yield Saga.put(_registerZcash())
      break
    case 'btc':
      yield Saga.put(_registerBTC())
      break
    // flow needs this for some reason
    case 'http':
    case 'https':
    case 'twitter':
    case 'facebook':
    case 'reddit':
    case 'github':
    case 'hackernews':
    case 'dns':
      yield Saga.call(_addServiceProof, action.payload.platform)
      break
    case 'pgp':
      yield Saga.put(navigateAppend(['pgp'], [peopleTab]))
  }
}

function* _addServiceProof(service: ProvablePlatformsType): SagaGenerator<any, any> {
  let _promptUsernameResponse: ?Object = null
  let _outputInstructionsResponse: ?Object = null

  yield Saga.put(_updateSigID(null))

  const proveStartProofChanMap = RPCTypes.proveStartProofRpcChannelMap(
    [
      'keybase.1.proveUi.promptUsername',
      'keybase.1.proveUi.outputInstructions',
      'keybase.1.proveUi.promptOverwrite',
      'keybase.1.proveUi.outputPrechecks',
      'keybase.1.proveUi.preProofWarning',
      'keybase.1.proveUi.okToCheck',
      'keybase.1.proveUi.displayRecheckWarning',
      'finished',
    ],
    {
      param: {
        auto: false,
        force: true,
        promptPosted: false,
        service,
        username: '',
      },
    }
  )

  while (true) {
    const incoming = yield proveStartProofChanMap.race({
      racers: {
        cancel: Saga.take(Constants.cancelAddProof),
        checkProof: Saga.take(Constants.checkProof),
        submitUsername: Saga.take(Constants.submitUsername),
      },
    })

    yield Saga.put(_waitingForResponse(false))

    if (incoming.cancel) {
      proveStartProofChanMap.close()

      const engineInst: Engine = yield Saga.call(engine)

      const InputCancelError = {code: RPCTypes.constantsStatusCode.scinputcanceled, desc: 'Cancel Add Proof'}
      if (_promptUsernameResponse) {
        yield Saga.call([engineInst, engineInst.cancelRPC], _promptUsernameResponse, InputCancelError)
        _promptUsernameResponse = null
      }

      if (_outputInstructionsResponse) {
        yield Saga.call([engineInst, engineInst.cancelRPC], _outputInstructionsResponse, InputCancelError)
        _outputInstructionsResponse = null
      }
      yield Saga.put(_waitingForResponse(false))
    } else if (incoming.submitUsername) {
      yield Saga.put(_cleanupUsername())
      if (_promptUsernameResponse) {
        yield Saga.put(_updateErrorText())
        const username = yield Saga.select((state: TypedState) => state.profile.username)
        _promptUsernameResponse.result(username)
        _promptUsernameResponse = null
        yield Saga.put(_waitingForResponse(true))
      }
    } else if (incoming.checkProof) {
      if (!incoming.checkProof.sigID && _outputInstructionsResponse) {
        _outputInstructionsResponse.result()
        _outputInstructionsResponse = null
        yield Saga.put(_waitingForResponse(true))
      }
    } else if (incoming['keybase.1.proveUi.promptUsername']) {
      _promptUsernameResponse = incoming['keybase.1.proveUi.promptUsername'].response
      if (incoming['keybase.1.proveUi.promptUsername'].params.prevError) {
        yield Saga.put(
          _updateErrorText(
            incoming['keybase.1.proveUi.promptUsername'].params.prevError.desc,
            incoming['keybase.1.proveUi.promptUsername'].params.prevError.code
          )
        )
      }
      yield Saga.put(navigateTo(['proveEnterUsername'], [peopleTab]))
    } else if (incoming['keybase.1.proveUi.outputInstructions']) {
      // $FlowIssue
      if (service === 'dnsOrGenericWebSite') {
        // We don't get this directly (yet) so we parse this out
        try {
          const match = incoming['keybase.1.proveUi.outputInstructions'].params.instructions.data.match(
            /<url>(http[s]+):\/\//
          )
          const protocol = match && match[1]
          yield Saga.put(_updatePlatform(protocol === 'https' ? 'https' : 'http'))
        } catch (_) {
          yield Saga.put(_updatePlatform('http'))
        }
      }

      yield Saga.put(_updateProofText(incoming['keybase.1.proveUi.outputInstructions'].params.proof))
      _outputInstructionsResponse = incoming['keybase.1.proveUi.outputInstructions'].response
      yield Saga.put(navigateAppend(['postProof'], [peopleTab]))
    } else if (incoming.finished) {
      yield Saga.put(_updateSigID(incoming.finished.params.sigID))
      if (incoming.finished.error) {
        console.warn('Error making proof')
        yield Saga.put(_updateErrorText(incoming.finished.error.desc, incoming.finished.error.code))
      } else {
        console.log('Start Proof done: ', incoming.finished.params.sigID)
        yield Saga.put(checkProof())
      }
      break
    } else if (incoming['keybase.1.proveUi.promptOverwrite']) {
      incoming['keybase.1.proveUi.promptOverwrite'].response.result(true)
      yield Saga.put(_waitingForResponse(true))
    } else if (incoming['keybase.1.proveUi.outputPrechecks']) {
      incoming['keybase.1.proveUi.outputPrechecks'].response.result()
      yield Saga.put(_waitingForResponse(true))
    } else if (incoming['keybase.1.proveUi.preProofWarning']) {
      incoming['keybase.1.proveUi.preProofWarning'].response.result(true)
      yield Saga.put(_waitingForResponse(true))
    } else if (incoming['keybase.1.proveUi.okToCheck']) {
      incoming['keybase.1.proveUi.okToCheck'].response.result(true)
      yield Saga.put(_waitingForResponse(true))
    } else if (incoming['keybase.1.proveUi.displayRecheckWarning']) {
      incoming['keybase.1.proveUi.displayRecheckWarning'].response.result()
      yield Saga.put(_waitingForResponse(true))
    }
  }
}

function* _cancelAddProof(): SagaGenerator<any, any> {
  yield Saga.put(_updateErrorText())
  yield Saga.put(navigateTo([], [peopleTab]))
}

function* _submitCryptoAddress(
  action: Constants.SubmitBTCAddress | Constants.SubmitZcashAddress
): SagaGenerator<any, any> {
  yield Saga.put(_cleanupUsername())
  const address = yield Saga.select((state: TypedState) => state.profile.username)
  // $FlowIssue doesn't understand computed properties
  const wantedFamily = {
    [Constants.submitBTCAddress]: 'bitcoin',
    [Constants.submitZcashAddress]: 'zcash',
  }[action.type]
  try {
    yield Saga.put(_waitingForResponse(true))
    yield Saga.call(RPCTypes.cryptocurrencyRegisterAddressRpcPromise, {
      param: {address, force: true, wantedFamily},
    })
    yield Saga.put(_waitingForResponse(false))
    yield Saga.put(_updateProofStatus(true, RPCTypes.proveCommonProofStatus.ok))
    yield Saga.put(navigateAppend(['confirmOrPending'], [peopleTab]))
  } catch (error) {
    console.warn('Error making proof')
    yield Saga.put(_waitingForResponse(false))
    yield Saga.put(_updateErrorText(error.desc, error.code))
  }
}

function* proofsSaga(): SagaGenerator<any, any> {
  yield safeTakeEvery(Constants.submitBTCAddress, _submitCryptoAddress)
  yield safeTakeEvery(Constants.submitZcashAddress, _submitCryptoAddress)
  yield safeTakeEvery(Constants.cancelAddProof, _cancelAddProof)
  yield safeTakeEvery(Constants.addProof, _addProof)
  yield safeTakeEvery(Constants.checkProof, _checkProof)
}

export {
  addProof,
  cancelAddProof,
  checkProof,
  submitBTCAddress,
  submitZcashAddress,
  submitUsername,
  proofsSaga,
}
