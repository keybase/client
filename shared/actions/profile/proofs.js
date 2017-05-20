// @flow
import * as Constants from '../../constants/profile'
import engine, {Engine} from '../../engine'
import {call, put, select, take} from 'redux-saga/effects'
import {
  cryptocurrencyRegisterAddressRpcPromise,
  proveStartProofRpcChannelMap,
  ConstantsStatusCode,
  ProveCommonProofStatus,
  proveCheckProofRpcPromise,
} from '../../constants/types/flow-types'
import {navigateTo, navigateAppend} from '../route-tree'
import {profileTab} from '../../constants/tabs'
import {safeTakeEvery} from '../../util/saga'

import type {
  AddProof,
  CancelAddProof,
  CheckProof,
  CleanupUsername,
  SubmitBTCAddress,
  SubmitUsername,
  UpdateErrorText,
  UpdatePlatform,
  UpdateProofStatus,
  UpdateProofText,
  UpdateSigID,
  Waiting,
  SubmitZcashAddress,
} from '../../constants/profile'
import type {NavigateTo} from '../../constants/route-tree'
import type {PlatformsExpandedType, ProvablePlatformsType} from '../../constants/types/more'
import type {SagaGenerator} from '../../constants/types/saga'
import type {SigID} from '../../constants/types/flow-types'
import type {TypedState} from '../../constants/reducer'

function _updatePlatform(platform: PlatformsExpandedType): UpdatePlatform {
  return {payload: {platform}, type: Constants.updatePlatform}
}

function _askTextOrDNS(): NavigateTo {
  return navigateTo(['proveWebsiteChoice'], [profileTab])
}

function _registerBTC(): NavigateTo {
  return navigateTo(['proveEnterUsername'], [profileTab])
}

function _registerZcash(): NavigateTo {
  return navigateTo(['proveEnterUsername'], [profileTab])
}

function addProof(platform: PlatformsExpandedType): AddProof {
  return {payload: {platform}, type: Constants.addProof}
}

function _cleanupUsername(): CleanupUsername {
  return {payload: undefined, type: Constants.cleanupUsername}
}

function submitUsername(): SubmitUsername {
  return {payload: undefined, type: Constants.submitUsername}
}

function cancelAddProof(): CancelAddProof {
  return {payload: undefined, type: Constants.cancelAddProof}
}

function submitBTCAddress(): SubmitBTCAddress {
  return {payload: undefined, type: Constants.submitBTCAddress}
}

function submitZcashAddress(): SubmitZcashAddress {
  return {payload: undefined, type: Constants.submitZcashAddress}
}

function _updateProofText(proof: string): UpdateProofText {
  return {payload: {proof}, type: Constants.updateProofText}
}

function _updateProofStatus(found, status): UpdateProofStatus {
  return {payload: {found, status}, type: Constants.updateProofStatus}
}

function _waitingForResponse(waiting: boolean): Waiting {
  return {payload: {waiting}, type: Constants.waiting}
}

function _updateErrorText(errorText: ?string, errorCode: ?number): UpdateErrorText {
  return {payload: {errorText, errorCode}, type: Constants.updateErrorText}
}

function _updateSigID(sigID: ?SigID): UpdateSigID {
  return {payload: {sigID}, type: Constants.updateSigID}
}

function checkProof(): CheckProof {
  return {payload: undefined, type: Constants.checkProof}
}

function* _checkProof(action: CheckProof): SagaGenerator<any, any> {
  const getSigID = (state: TypedState) => state.profile.sigID
  const sigID = (yield select(getSigID): any)
  if (!sigID) {
    return
  }

  yield put(_updateErrorText(null))

  try {
    yield put(_waitingForResponse(true))
    const {found, status} = yield call(proveCheckProofRpcPromise, {param: {sigID}})
    yield put(_waitingForResponse(false))

    // Values higher than baseHardError are hard errors, below are soft errors (could eventually be resolved by doing nothing)
    if (!found && status >= ProveCommonProofStatus.baseHardError) {
      yield put(_updateErrorText("We couldn't find your proof. Please retry!"))
    } else {
      yield put(_updateProofStatus(found, status))
      yield put(navigateAppend(['confirmOrPending'], [profileTab]))
    }
  } catch (error) {
    yield put(_waitingForResponse(false))
    console.warn('Error getting proof update')
    yield put(_updateErrorText("We couldn't verify your proof. Please retry!"))
  }
}

function* _addProof(action: AddProof): SagaGenerator<any, any> {
  yield put(_updatePlatform(action.payload.platform))
  yield put(_updateErrorText())

  // Special cases
  switch (action.payload.platform) {
    case 'dnsOrGenericWebSite':
      yield put(_askTextOrDNS())
      break
    case 'zcash':
      yield put(_registerZcash())
      break
    case 'btc':
      yield put(_registerBTC())
      break
    // flow needs this for some reason
    case 'http':
    case 'https':
    case 'twitter':
    case 'facebook':
    case 'reddit':
    case 'github':
    case 'coinbase':
    case 'hackernews':
    case 'dns':
      yield call(_addServiceProof, action.payload.platform)
      break
    case 'pgp':
      yield put(navigateAppend(['pgp'], [profileTab]))
  }
}

function* _addServiceProof(service: ProvablePlatformsType): SagaGenerator<any, any> {
  let _promptUsernameResponse: ?Object = null
  let _outputInstructionsResponse: ?Object = null

  yield put(_updateSigID(null))

  const proveStartProofChanMap = proveStartProofRpcChannelMap(
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
      removeNs: true,
      racers: {
        cancel: take(Constants.cancelAddProof),
        checkProof: take(Constants.checkProof),
        submitUsername: take(Constants.submitUsername),
      },
    })

    yield put(_waitingForResponse(false))

    if (incoming.cancel) {
      proveStartProofChanMap.close()

      const engineInst: Engine = yield call(engine)

      const InputCancelError = {code: ConstantsStatusCode.scinputcanceled, desc: 'Cancel Add Proof'}
      if (_promptUsernameResponse) {
        yield call([engineInst, engineInst.cancelRPC], _promptUsernameResponse, InputCancelError)
        _promptUsernameResponse = null
      }

      if (_outputInstructionsResponse) {
        yield call([engineInst, engineInst.cancelRPC], _outputInstructionsResponse, InputCancelError)
        _outputInstructionsResponse = null
      }
      yield put(_waitingForResponse(false))
    } else if (incoming.submitUsername) {
      yield put(_cleanupUsername())
      if (_promptUsernameResponse) {
        yield put(_updateErrorText())
        const username = yield select(state => state.profile.username)
        _promptUsernameResponse.result(username)
        _promptUsernameResponse = null
        yield put(_waitingForResponse(true))
      }
    } else if (incoming.checkProof) {
      if (!incoming.checkProof.sigID && _outputInstructionsResponse) {
        _outputInstructionsResponse.result()
        _outputInstructionsResponse = null
        yield put(_waitingForResponse(true))
      }
    } else if (incoming.promptUsername) {
      _promptUsernameResponse = incoming.promptUsername.response
      if (incoming.promptUsername.params.prevError) {
        yield put(
          _updateErrorText(
            incoming.promptUsername.params.prevError.desc,
            incoming.promptUsername.params.prevError.code
          )
        )
      }
      yield put(navigateTo(['proveEnterUsername'], [profileTab]))
    } else if (incoming.outputInstructions) {
      if (service === 'dnsOrGenericWebSite') {
        // We don't get this directly (yet) so we parse this out
        try {
          const match = incoming.outputInstructions.params.instructions.data.match(/<url>(http[s]+):\/\//)
          const protocol = match && match[1]
          yield put(_updatePlatform(protocol === 'https' ? 'https' : 'http'))
        } catch (_) {
          yield put(_updatePlatform('http'))
        }
      }

      yield put(_updateProofText(incoming.outputInstructions.params.proof))
      _outputInstructionsResponse = incoming.outputInstructions.response
      yield put(navigateAppend(['postProof'], [profileTab]))
    } else if (incoming.finished) {
      yield put(_updateSigID(incoming.finished.params.sigID))
      if (incoming.finished.error) {
        console.warn('Error making proof')
        yield put(_updateErrorText(incoming.finished.error.desc, incoming.finished.error.code))
      } else {
        console.log('Start Proof done: ', incoming.finished.params.sigID)
        yield put(checkProof())
      }
      break
    } else if (incoming.promptOverwrite) {
      incoming.promptOverwrite.response.result(true)
      yield put(_waitingForResponse(true))
    } else if (incoming.outputPrechecks) {
      incoming.outputPrechecks.response.result()
      yield put(_waitingForResponse(true))
    } else if (incoming.preProofWarning) {
      incoming.preProofWarning.response.result(true)
      yield put(_waitingForResponse(true))
    } else if (incoming.okToCheck) {
      incoming.okToCheck.response.result(true)
      yield put(_waitingForResponse(true))
    } else if (incoming.displayRecheckWarning) {
      incoming.displayRecheckWarning.response.result()
      yield put(_waitingForResponse(true))
    }
  }
}

function* _cancelAddProof(): SagaGenerator<any, any> {
  yield put(_updateErrorText())
  yield put(navigateTo([], [profileTab]))
}

function* _submitCryptoAddress(action: SubmitBTCAddress | SubmitZcashAddress): SagaGenerator<any, any> {
  yield put(_cleanupUsername())
  const address = yield select(state => state.profile.username)
  const wantedFamily = {
    [Constants.submitBTCAddress]: 'bitcoin',
    [Constants.submitZcashAddress]: 'zcash',
  }[action.type]
  try {
    yield put(_waitingForResponse(true))
    yield call(cryptocurrencyRegisterAddressRpcPromise, {param: {address, force: true, wantedFamily}})
    yield put(_waitingForResponse(false))
    yield put(_updateProofStatus(true, ProveCommonProofStatus.ok))
    yield put(navigateAppend(['confirmOrPending'], [profileTab]))
  } catch (error) {
    console.warn('Error making proof')
    yield put(_waitingForResponse(false))
    yield put(_updateErrorText(error.desc, error.code))
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
