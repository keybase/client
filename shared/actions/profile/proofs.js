// @flow
import * as Constants from '../../constants/profile'
import engine, {Engine} from '../../engine'
import {BTCRegisterBTCRpcPromise, proveStartProofRpcPromise, ConstantsStatusCode, ProveCommonProofStatus, proveCheckProofRpcPromise} from '../../constants/types/flow-types'
import {call, put, select} from 'redux-saga/effects'
import {navigateUp, navigateTo, routeAppend} from '../../actions/router'
import {profileTab} from '../../constants/tabs'
import {takeEvery} from 'redux-saga'

import type {SagaGenerator, ChannelConfig, ChannelMap} from '../../constants/types/saga'
import type {Dispatch, AsyncAction} from '../../constants/types/flux'
import type {PlatformsExpandedType, ProvablePlatformsType} from '../../constants/types/more'
import type {SigID} from '../../constants/types/flow-types'
import type {
  CancelAddProof,
  CleanupUsername,
  SubmitBTCAddress,
  UpdateErrorText,
  UpdatePlatform,
  UpdateProofStatus,
  UpdateProofText,
  UpdateSigID,
  Waiting,
AddServiceProof,
} from '../../constants/profile'
import type {SagaGenerator} from '../../constants/types/saga'
import type {TypedState} from '../../constants/reducer'

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

function _makeWaitingHandler (dispatch: Dispatch): {waitingHandler: (waiting: boolean) => void} {
  return {
    waitingHandler: (waiting: boolean) => { dispatch(_waitingForResponse(waiting)) },
  }
}

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

function checkSpecificProof (sigID: ?string): AsyncAction {
  return (dispatch, getState) => {
    if (sigID) {
      dispatch(_checkProof(sigID, false))
    }
  }
}

function checkProof (): AsyncAction {
  return (dispatch, getState) => {
    // This is a little tricky...
    // As part of the _addServiceProof RPC it will automatically check the proof when we finish up that flow.
    // That's the first context in which this action is dispatched.
    // If that works the first time, the outputInstructionsResponse.result() will just continue the _addServiceProof flow and we'll be done.
    // If that doesn't work we'll actually error out of the entire _addServiceProof RPC and be sitting on the outputInstructions page (this is ok)
    // The user can continue to hit the 'ok check it' button and we'll call proveCheckProofRpc
    if (_outputInstructionsResponse) {
      _outputInstructionsResponse.result()
      _outputInstructionsResponse = null
    } else {
      // We just want to check the proof, we're NOT in _addServiceProof RPC anymore
      const sigID = getState().profile.sigID
      if (sigID) {
        dispatch(_checkProof(sigID, true))
      }
    }
  }
}

function _checkProof (sigID: string, currentlyAdding: boolean): AsyncAction {
  return (dispatch, getState) => {
    if (currentlyAdding) {
      dispatch(_updateErrorText(null))
    }

    proveCheckProofRpc({
      ..._makeWaitingHandler(dispatch),
      param: {
        sigID,
      },
      callback: (error, {found, status}) => {
        if (error) {
          console.warn('Error getting proof update')
          if (currentlyAdding) {
            dispatch(_updateErrorText("We couldn't verify your proof. Please retry!"))
          }
        } else {
          if (currentlyAdding) {
            // this enum value is the divider between soft and hard errors
            if (!found && status >= ProveCommonProofStatus.baseHardError) {
              dispatch(_updateErrorText("We couldn't find your proof. Please retry!"))
            } else {
              dispatch(_updateProofStatus(found, status))
              dispatch(navigateTo([{path: 'ConfirmOrPending'}], profileTab))
            }
          }
        }
      },
    })
  }
}

function addProof (platform: PlatformsExpandedType): AsyncAction {
  return (dispatch) => {
    dispatch(_updatePlatform(platform))
    dispatch(_updateErrorText(null))

    // Special cases
    switch (platform) {
      case 'dnsOrGenericWebSite':
        dispatch(_askTextOrDNS())
        break
      case 'btc':
        dispatch(_registerBTC())
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
        dispatch(_addServiceProof(platform))
        break
      case 'pgp':
        dispatch(routeAppend(['pgp', 'choice']))
    }
  }
}

function _updatePlatform (platform: PlatformsExpandedType): UpdatePlatform {
  return {
    type: Constants.updatePlatform,
    payload: {platform},
  }
}

function _askTextOrDNS (): AsyncAction {
  return (dispatch) => {
    dispatch(navigateTo([{path: 'ProveWebsiteChoice'}], profileTab))
  }
}

function _registerBTC (): AsyncAction {
  return (dispatch) => {
    dispatch(navigateTo([{path: 'ProveEnterUsername'}], profileTab))
  }
}

function * _addServiceProof (service: ProvablePlatformsType): SagaGenerator<any, any> {
  // TODO // ..._makeWaitingHandler(dispatch),
  //
  const channelConfig = singleFixedChannelConfig([
    'keybase.1.proveUi.promptUsername',
    'keybase.1.proveUi.outputInstructions',
    'keybase.1.proveUi.promptOverwrite',
    'keybase.1.proveUi.outputPrechecks',
    'keybase.1.proveUi.preProofWarning',
    'keybase.1.proveUi.okToCheck',
    'keybase.1.proveUi.displayRecheckWarning',
  ])

  const proveStartProofChanMap: ChannelMap<any> = createChannelMap(channelConfig)
  proveStartProofRpc({
    param: {
      auto: false,
      force: true,
      promptPosted: false,
      service,
      username: '',
    },
    incomingCallMap: {
      'keybase.1.proveUi.promptUsername': ({prompt, prevError}, response) => {
        putOnChannelMap(channelMap, 'keybase.1.proveUi.promptUsername', {params: {prompt, prevError}, response})
        // _promptUsernameResponse = response
        // if (prevError) {
        // dispatch(_updateErrorText(prevError.desc, prevError.code))
        // }
        // dispatch(navigateTo([{path: 'ProveEnterUsername'}], profileTab))
      },
      'keybase.1.proveUi.outputInstructions': ({instructions, proof}, response) => {
        putOnChannelMap(channelMap, 'keybase.1.proveUi.outputInstructions', {params: {instructions, proof}, response})
        // if (service === 'dnsOrGenericWebSite') { // We don't get this directly (yet) so we parse this out
        // try {
        // const match = instructions.data.match(/<url>(http[s]+):\/\//)
        // const protocol = match && match[1]
        // _updatePlatform(protocol === 'https' ? 'https' : 'http')
        // } catch (_) {
        // _updatePlatform('http')
        // }
        // }

        // dispatch(_updateProofText(proof))
        // _outputInstructionsResponse = response
        // dispatch(navigateTo([{path: 'PostProof'}], profileTab))
      },
      'keybase.1.proveUi.promptOverwrite': (_, response) => response.result(true),
      'keybase.1.proveUi.outputPrechecks': (_, response) => response.result(),
      'keybase.1.proveUi.preProofWarning': (_, response) => response.result(true),
      'keybase.1.proveUi.okToCheck': (_, response) => response.result(true),
      'keybase.1.proveUi.displayRecheckWarning': (_, response) => response.result(),
    },
    callback: (error) => {
      putOnChannelMap(channelMap, 'finished', {error})
      closeChannelMap(channelMap)
    },
  })

  try {
  } catch (error) {
    closeChannelMap(proveStartProofChanMap)
    console.log('error in addServiceProof', error)
  }
  }

   // takeFromChannelMap(proveStartProofChanMap, 'keybase.1.pgpUi.keyGenerated'),

// success stuff TODO
    yield put(_updateSigID(sigID))
    console.log('Start Proof done: ', sigID)
    yield put(checkProof())

// fail stuff TODO
  } catch (error) {
    console.warn('Error making proof')
    yield put(_updateSigID(sigID))
    yield put(_updateErrorText(error.desc, error.code))
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

  ]
}

export {
  addProof,
  cancelAddProof,
  checkProof,
  checkSpecificProof,
  submitBTCAddress,
  submitUsername,
  proofsSaga,
}
