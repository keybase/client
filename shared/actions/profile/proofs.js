// @flow
import * as Constants from '../../constants/profile'
import engine, {Engine} from '../../engine'
import {BTCRegisterBTCRpcPromise, proveStartProofRpcChannelMap, ConstantsStatusCode, ProveCommonProofStatus, proveCheckProofRpcPromise} from '../../constants/types/flow-types'
import {call, put, select, race} from 'redux-saga/effects'
import {navigateUp, navigateTo, routeAppend} from '../../actions/router'
import {profileTab} from '../../constants/tabs'
import {singleFixedChannelConfig, closeChannelMap, takeFromChannelMap} from '../../util/saga'
import {takeEvery} from 'redux-saga'

import type {SagaGenerator, ChannelMap} from '../../constants/types/saga'
import type {Dispatch, AsyncAction} from '../../constants/types/flux'
import type {PlatformsExpandedType, ProvablePlatformsType} from '../../constants/types/more'
import type {SigID} from '../../constants/types/flow-types'
import type {
  RegisterBTC,
  AskTextOrDNS,
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
} from '../../constants/profile'

// Soon to be saga-ed away. We bookkeep the respsonse object in the incomingCallMap so we can call it in our actions
// TODO kill this
let _promptUsernameResponse: ?Object = null
let _outputInstructionsResponse: ?Object = null

function _updateProofText (proof: string): UpdateProofText {
  return {
    type: Constants.updateProofText,
    payload: {proof},
  }
}

function _updateProofStatus (found, status): UpdateProofStatus {
  return {
    type: Constants.updateProofStatus,
    payload: {found, status},
  }
}

// function _makeWaitingHandler (dispatch: Dispatch): {waitingHandler: (waiting: boolean) => void} {
  // return {
    // waitingHandler: (waiting: boolean) => { dispatch(_waitingForResponse(waiting)) },
  // }
// }

function _waitingForResponse (waiting: boolean): Waiting {
  return {
    type: Constants.waiting,
    payload: {waiting},
  }
}

function _updateErrorText (errorText: ?string, errorCode: ?number): UpdateErrorText {
  return {
    type: Constants.updateErrorText,
    payload: {errorText, errorCode},
  }
}

function _updateSigID (sigID: SigID): UpdateSigID {
  return {
    type: Constants.updateSigID,
    payload: {sigID},
  }
}

function checkProof (sigID: ?string): CheckProof {
  return {
    type: Constants.checkProof,
    payload: {sigID},
  }
}

function * _checkProof (action: CheckProof): SagaGenerator<any, any> {
  // TODO
  // if (_outputInstructionsResponse) {
    // _outputInstructionsResponse.result()
    // _outputInstructionsResponse = null
    // return
  // }

  // let sigID = action.payload.sigID
  // if (!sigID) {
    // sigID = yield select(state => state.profile.sigID)
  // }

  // yield put(_updateErrorText(null))

  // // TODO
    // // ..._makeWaitingHandler(dispatch),
  // try {
    // const {found, status} = yield call(proveCheckProofRpcPromise, {param: {sigID}})
    // if (currentlyAdding) {
      // // this enum value is the divider between soft and hard errors
      // if (!found && status >= ProveCommonProofStatus.baseHardError) {
        // yield put(_updateErrorText("We couldn't find your proof. Please retry!"))
      // } else {
        // yield put(_updateProofStatus(found, status))
        // yield put(navigateTo([{path: 'ConfirmOrPending'}], profileTab))
      // }
    // }
  // } catch (error) {
    // console.warn('Error getting proof update')
    // if (currentlyAdding) {
      // yield put(_updateErrorText("We couldn't verify your proof. Please retry!"))
    // }
  // }
}

function addProof (platform: PlatformsExpandedType): AddProof {
  return {type: Constants.addProof, payload: {platform}}
}

function * _addProof (action: AddProof): SagaGenerator<any, any> {
  yield put(_updatePlatform(action.payload.platform))
  yield put(_updateErrorText(null))

  // Special cases
  switch (action.payload.platform) {
    case 'dnsOrGenericWebSite':
      yield put(_askTextOrDNS())
      break
    case 'btc':
      yield yield put(_registerBTC())
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
      yield put(_addServiceProof(action.payload.platform))
      break
    case 'pgp':
      yield put(routeAppend(['pgp', 'choice']))
  }
}

function _updatePlatform (platform: PlatformsExpandedType): UpdatePlatform {
  return {
    type: Constants.updatePlatform,
    payload: {platform},
  }
}

function _askTextOrDNS (): AskTextOrDNS {
  return navigateTo([{path: 'ProveWebsiteChoice'}], profileTab)
}

function _registerBTC (): RegisterBTC {
  return navigateTo([{path: 'ProveEnterUsername'}], profileTab)
}

function * _addServiceProof (service: ProvablePlatformsType): SagaGenerator<any, any> {
  // // TODO // ..._makeWaitingHandler(dispatch),
  const channelConfig = singleFixedChannelConfig([
    'keybase.1.proveUi.promptUsername',
    'keybase.1.proveUi.outputInstructions',
    'keybase.1.proveUi.promptOverwrite',
    'keybase.1.proveUi.outputPrechecks',
    'keybase.1.proveUi.preProofWarning',
    'keybase.1.proveUi.okToCheck',
    'keybase.1.proveUi.displayRecheckWarning',
  ])

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
    const {promptUsername, outputInstructions, promptOverwrite, outputPrechecks, preProofWarning, okToCheck, displayRecheckWarning, finished} = yield race({
      'promptUsername': takeFromChannelMap(proveStartProofChanMap, 'keybase.1.proveUi.promptUsername'),
      'outputInstructions': takeFromChannelMap(proveStartProofChanMap, 'keybase.1.proveUi.outputInstructions'),
      'promptOverwrite': takeFromChannelMap(proveStartProofChanMap, 'keybase.1.proveUi.promptOverwrite'),
      'outputPrechecks': takeFromChannelMap(proveStartProofChanMap, 'keybase.1.proveUi.outputPrechecks'),
      'preProofWarning': takeFromChannelMap(proveStartProofChanMap, 'keybase.1.proveUi.preProofWarning'),
      'okToCheck': takeFromChannelMap(proveStartProofChanMap, 'keybase.1.proveUi.okToCheck'),
      'displayRecheckWarning': takeFromChannelMap(proveStartProofChanMap, 'keybase.1.proveUi.displayRecheckWarning'),
      'finished': takeFromChannelMap(proveStartProofChanMap, 'finished'),
    })

    if (promptUsername) {
      _promptUsernameResponse = promptUsername.response
      if (promptUsername.params.prevError) {
        yield put(_updateErrorText(promptUsername.params.prevError.desc, promptUsername.params.prevError.code))
      }
      yield put(navigateTo([{path: 'ProveEnterUsername'}], profileTab))
    } else if (outputInstructions) {
      if (service === 'dnsOrGenericWebSite') { // We don't get this directly (yet) so we parse this out
        try {
          const match = outputInstructions.params.instructions.data.match(/<url>(http[s]+):\/\//)
          const protocol = match && match[1]
          yield put(_updatePlatform(protocol === 'https' ? 'https' : 'http'))
        } catch (_) {
          yield put(_updatePlatform('http'))
        }
      }

      yield put(_updateProofText(outputInstructions.params.proof))
      _outputInstructionsResponse = outputInstructions.response
      yield put(navigateTo([{path: 'PostProof'}], profileTab))
    } else if (promptOverwrite) {
      promptOverwrite.response.result(true)
    } else if (outputPrechecks) {
      outputPrechecks.response.result()
    } else if (preProofWarning) {
      preProofWarning.response.result(true)
    } else if (okToCheck) {
      okToCheck.response.result(true)
    } else if (displayRecheckWarning) {
      displayRecheckWarning.response.result()
    } else if (finished) {
      if (finished.error) {
        console.warn('Error making proof')
        yield put(_updateSigID(finished.params.sigID))
        yield put(_updateErrorText(finished.error.desc, finished.error.code))
      } else {
        yield put(_updateSigID(finished.params.sigID))
        console.log('Start Proof done: ', finished.params.sigID)
        yield put(checkProof())
      }
      closeChannelMap(proveStartProofChanMap)
      break
    }
  }
}

function _cleanupUsername (): CleanupUsername {
  return {type: Constants.cleanupUsername, payload: undefined}
}

function submitUsername (): SubmitUsername {
  return {type: Constants.submitUsername, payload: undefined}
}

function * _submitUsername (): SagaGenerator<any, any> {
  yield put(_cleanupUsername())
  if (_promptUsernameResponse) {
    yield put(_updateErrorText(null))
    const username = yield select(state => state.profile.username)
    _promptUsernameResponse.result(username)
    _promptUsernameResponse = null
  }
}

function cancelAddProof (): CancelAddProof {
  return {type: Constants.cancelAddProof, payload: undefined}
}

function * _cancelAddProof (): SagaGenerator<any, any> {
  const InputCancelError = {desc: 'Cancel Add Proof', code: ConstantsStatusCode.scinputcanceled}
  yield put(_updateErrorText(null))

  // $ForceType
  const engineInst: Engine = yield call(engine)

  if (_promptUsernameResponse) {
    yield call([engineInst, engineInst.cancelRPC], _promptUsernameResponse, InputCancelError)
    _promptUsernameResponse = null
  }

  if (_outputInstructionsResponse) {
    yield call([engineInst, engineInst.cancelRPC], _outputInstructionsResponse, InputCancelError)
    _outputInstructionsResponse = null
  }

  yield put(navigateUp())
}

function submitBTCAddress (): SubmitBTCAddress {
  return {type: Constants.submitBTCAddress, payload: undefined}
}

function * _submitBTCAddress (): SagaGenerator<any, any> {
  yield put(_cleanupUsername())
  const address = yield select(state => state.profile.username)
  try {
    yield put(_waitingForResponse(true))
    yield call(BTCRegisterBTCRpcPromise, {param: {address, force: true}})
    yield put(_waitingForResponse(false))
    yield put(_updateProofStatus(true, ProveCommonProofStatus.ok))
    yield put(navigateTo([{path: 'ConfirmOrPending'}], profileTab))
  } catch (error) {
    console.warn('Error making proof')
    yield put(_waitingForResponse(false))
    yield put(_updateErrorText(error.desc, error.code))
  }
}

function * proofsSaga (): SagaGenerator<any, any> {
  yield [
    takeEvery(Constants.submitBTCAddress, _submitBTCAddress),
    takeEvery(Constants.cancelAddProof, _cancelAddProof),
    takeEvery(Constants.submitUsername, _submitUsername),
    takeEvery(Constants.addProof, _addProof),
    takeEvery(Constants.checkProof, _checkProof),
  ]
}

export {
  addProof,
  cancelAddProof,
  checkProof,
  submitBTCAddress,
  submitUsername,
  proofsSaga,
}
