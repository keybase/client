// @flow
import * as Constants from '../../constants/profile'
import engine, {Engine} from '../../engine'
import {cryptocurrencyRegisterAddressRpcPromise, proveStartProofRpcChannelMap, ConstantsStatusCode, ProveCommonProofStatus, proveCheckProofRpcPromise} from '../../constants/types/flow-types'
import {call, put, select, race, take} from 'redux-saga/effects'
import {navigateTo, navigateAppend} from '../route-tree'
import {profileTab} from '../../constants/tabs'
import {singleFixedChannelConfig, closeChannelMap, takeFromChannelMap, safeTakeEvery} from '../../util/saga'

import type {NavigateTo} from '../../constants/route-tree'
import type {AddProof, CancelAddProof, CheckProof, CleanupUsername, SubmitBTCAddress, SubmitUsername, UpdateErrorText, UpdatePlatform, UpdateProofStatus, UpdateProofText, UpdateSigID, Waiting, SubmitZcashAddress} from '../../constants/profile'
import type {PlatformsExpandedType, ProvablePlatformsType} from '../../constants/types/more'
import type {SagaGenerator, ChannelMap} from '../../constants/types/saga'
import type {SigID} from '../../constants/types/flow-types'
import type {TypedState} from '../../constants/reducer'

function _updatePlatform (platform: PlatformsExpandedType): UpdatePlatform {
  return {type: Constants.updatePlatform, payload: {platform}}
}

function _askTextOrDNS (): NavigateTo {
  return navigateTo(['proveWebsiteChoice'], [profileTab])
}

function _registerBTC (): NavigateTo {
  return navigateTo(['proveEnterUsername'], [profileTab])
}

function _registerZcash (): NavigateTo {
  return navigateTo(['proveEnterUsername'], [profileTab])
}

function addProof (platform: PlatformsExpandedType): AddProof {
  return {type: Constants.addProof, payload: {platform}}
}

function _cleanupUsername (): CleanupUsername {
  return {type: Constants.cleanupUsername, payload: undefined}
}

function submitUsername (): SubmitUsername {
  return {type: Constants.submitUsername, payload: undefined}
}

function cancelAddProof (): CancelAddProof {
  return {type: Constants.cancelAddProof, payload: undefined}
}

function submitBTCAddress (): SubmitBTCAddress {
  return {type: Constants.submitBTCAddress, payload: undefined}
}

function submitZcashAddress (): SubmitZcashAddress {
  return {type: Constants.submitZcashAddress, payload: undefined}
}

function _updateProofText (proof: string): UpdateProofText {
  return {type: Constants.updateProofText, payload: {proof}}
}

function _updateProofStatus (found, status): UpdateProofStatus {
  return {type: Constants.updateProofStatus, payload: {found, status}}
}

function _waitingForResponse (waiting: boolean): Waiting {
  return {type: Constants.waiting, payload: {waiting}}
}

function _updateErrorText (errorText: ?string, errorCode: ?number): UpdateErrorText {
  return {type: Constants.updateErrorText, payload: {errorText, errorCode}}
}

function _updateSigID (sigID: ?SigID): UpdateSigID {
  return {type: Constants.updateSigID, payload: {sigID}}
}

function checkProof (): CheckProof {
  return {type: Constants.checkProof, payload: undefined}
}

function * _checkProof (action: CheckProof): SagaGenerator<any, any> {
  const getSigID = (state: TypedState) => state.profile.sigID
  const sigID = ((yield select(getSigID)): any)
  if (!sigID) {
    return
  }

  yield put(_updateErrorText(null))

  try {
    yield put(_waitingForResponse(true))
    // $ForceType
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

function * _addProof (action: AddProof): SagaGenerator<any, any> {
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

function * _addServiceProof (service: ProvablePlatformsType): SagaGenerator<any, any> {
  let _promptUsernameResponse: ?Object = null
  let _outputInstructionsResponse: ?Object = null

  const channelConfig = singleFixedChannelConfig([
    'keybase.1.proveUi.promptUsername',
    'keybase.1.proveUi.outputInstructions',
    'keybase.1.proveUi.promptOverwrite',
    'keybase.1.proveUi.outputPrechecks',
    'keybase.1.proveUi.preProofWarning',
    'keybase.1.proveUi.okToCheck',
    'keybase.1.proveUi.displayRecheckWarning',
    'finished',
  ])

  yield put(_updateSigID(null))

  const proveStartProofChanMap: ChannelMap<any> = proveStartProofRpcChannelMap(channelConfig, {
    param: {
      auto: false,
      force: true,
      promptPosted: false,
      service,
      username: '',
    },
  })

  while (true) {
    // $ForceType
    const incoming: {[key: string]: any} = yield race({
      promptUsername: takeFromChannelMap(proveStartProofChanMap, 'keybase.1.proveUi.promptUsername'),
      outputInstructions: takeFromChannelMap(proveStartProofChanMap, 'keybase.1.proveUi.outputInstructions'),
      promptOverwrite: takeFromChannelMap(proveStartProofChanMap, 'keybase.1.proveUi.promptOverwrite'),
      outputPrechecks: takeFromChannelMap(proveStartProofChanMap, 'keybase.1.proveUi.outputPrechecks'),
      preProofWarning: takeFromChannelMap(proveStartProofChanMap, 'keybase.1.proveUi.preProofWarning'),
      okToCheck: takeFromChannelMap(proveStartProofChanMap, 'keybase.1.proveUi.okToCheck'),
      displayRecheckWarning: takeFromChannelMap(proveStartProofChanMap, 'keybase.1.proveUi.displayRecheckWarning'),
      finished: takeFromChannelMap(proveStartProofChanMap, 'finished'),
      cancel: take(Constants.cancelAddProof),
      submitUsername: take(Constants.submitUsername),
      checkProof: take(Constants.checkProof),
    })
    yield put(_waitingForResponse(false))

    if (incoming.cancel) {
      closeChannelMap(proveStartProofChanMap)

      // $ForceType
      const engineInst: Engine = yield call(engine)

      const InputCancelError = {desc: 'Cancel Add Proof', code: ConstantsStatusCode.scinputcanceled}
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
        yield put(_updateErrorText(incoming.promptUsername.params.prevError.desc, incoming.promptUsername.params.prevError.code))
      }
      yield put(navigateTo(['proveEnterUsername'], [profileTab]))
    } else if (incoming.outputInstructions) {
      if (service === 'dnsOrGenericWebSite') { // We don't get this directly (yet) so we parse this out
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
      closeChannelMap(proveStartProofChanMap)
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

function * _cancelAddProof (): SagaGenerator<any, any> {
  yield put(_updateErrorText())
  yield put(navigateTo([], [profileTab]))
}

function * _submitCryptoAddress (action: SubmitBTCAddress | SubmitZcashAddress): SagaGenerator<any, any> {
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
    yield put(navigateAppend(['ConfirmOrPending'], [profileTab]))
  } catch (error) {
    console.warn('Error making proof')
    yield put(_waitingForResponse(false))
    yield put(_updateErrorText(error.desc, error.code))
  }
}

function * proofsSaga (): SagaGenerator<any, any> {
  yield [
    safeTakeEvery(Constants.submitBTCAddress, _submitCryptoAddress),
    safeTakeEvery(Constants.submitZcashAddress, _submitCryptoAddress),
    safeTakeEvery(Constants.cancelAddProof, _cancelAddProof),
    safeTakeEvery(Constants.addProof, _addProof),
    safeTakeEvery(Constants.checkProof, _checkProof),
  ]
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
