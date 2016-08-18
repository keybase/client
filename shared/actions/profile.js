// @flow
import * as Constants from '../constants/profile'
import engine from '../engine'
import openURL from '../util/open-url'
import {apiserverPostRpc, proveStartProofRpc, proveCheckProofRpc, revokeRevokeSigsRpc, BTCRegisterBTCRpc, pgpPgpKeyGenRpc, revokeRevokeKeyRpc} from '../constants/types/flow-types'
import {bindActionCreators} from 'redux'
import {constants as RpcConstants, proveCommon} from '../constants/types/keybase-v1'
import {getMyProfile} from './tracker'
import {navigateUp, navigateTo, routeAppend} from '../actions/router'
import {profileTab} from '../constants/tabs'
import {call, put, take, select} from 'redux-saga/effects'
import {takeLatest, takeEvery} from 'redux-saga'

import type {SagaGenerator} from '../constants/types/saga'
import type {Dispatch, AsyncAction} from '../constants/types/flux'
import type {PlatformsExpandedType, ProvablePlatformsType} from '../constants/types/more'
import type {SigID, KID} from '../constants/types/flow-types'
import type {UpdateUsername, UpdatePlatform, Waiting, UpdateProofText, UpdateErrorText, UpdateProofStatus,
  UpdateSigID, WaitingRevokeProof, FinishRevokeProof, CleanupUsername, UpdatePgpInfo, PgpInfo, GeneratePgp, FinishedWithKeyGen, DropPgp} from '../constants/profile'
import {isValidEmail, isValidName} from '../util/simple-validators'

const InputCancelError = {desc: 'Cancel Add Proof', code: RpcConstants.StatusCode.scinputcanceled}

// Soon to be saga-ed away. We bookkeep the respsonse object in the incomingCallMap so we can call it in our actions
let promptUsernameResponse: ?Object = null
let outputInstructionsResponse: ?Object = null

function editProfile (bio: string, fullname: string, location: string): AsyncAction {
  return (dispatch) => {
    dispatch({
      type: Constants.editingProfile,
      payload: {bio, fullname, location},
    })

    apiserverPostRpc({
      param: {
        endpoint: 'profile-edit',
        args: [
          {key: 'bio', value: bio},
          {key: 'full_name', value: fullname},
          {key: 'location', value: location},
        ],
      },
      incomingCallMap: {},
      callback: (error, status) => {
        // Flow is weird here, we have to give it true or false directly
        // instead of just giving it !!error
        if (error) {
          dispatch({
            type: Constants.editedProfile,
            payload: error,
            error: true,
          })
        } else {
          dispatch({
            type: Constants.editedProfile,
            payload: null,
            error: false,
          })
          dispatch(navigateUp())
        }
      },
    })
  }
}

function _makeWaitingHandler (dispatch: Dispatch): {waitingHandler: (waiting: boolean) => void} {
  return {
    waitingHandler: bindActionCreators(_waitingForResponse, dispatch),
  }
}

function _waitingForResponse (waiting: boolean): Waiting {
  return {
    type: Constants.waiting,
    payload: {waiting},
  }
}

function updatePlatform (platform: PlatformsExpandedType): UpdatePlatform {
  return {
    type: Constants.updatePlatform,
    payload: {platform},
  }
}

function _cleanupUsername (): CleanupUsername {
  return {
    type: Constants.cleanupUsername,
    payload: undefined,
  }
}

function submitUsername (): AsyncAction {
  return (dispatch, getState) => {
    dispatch(_cleanupUsername())
    if (promptUsernameResponse) {
      dispatch(_updateErrorText(null))
      promptUsernameResponse.result(getState().profile.username)
      promptUsernameResponse = null
    }
  }
}

function updateUsername (username: string): UpdateUsername {
  return {
    type: Constants.updateUsername,
    payload: {username},
  }
}

function cancelAddProof (): AsyncAction {
  return (dispatch) => {
    dispatch(_updateErrorText(null))
    if (promptUsernameResponse) {
      engine.cancelRPC(promptUsernameResponse, InputCancelError)
      promptUsernameResponse = null
    }

    if (outputInstructionsResponse) {
      engine.cancelRPC(outputInstructionsResponse, InputCancelError)
      outputInstructionsResponse = null
    }

    dispatch(navigateUp())
  }
}

function _updateProofText (proof: string): UpdateProofText {
  return {
    type: Constants.updateProofText,
    payload: {proof},
  }
}

function _updateErrorText (errorText: ?string, errorCode: ?number): UpdateErrorText {
  return {
    type: Constants.updateErrorText,
    payload: {errorText, errorCode},
  }
}

function _updateProofStatus (found, status): UpdateProofStatus {
  return {
    type: Constants.updateProofStatus,
    payload: {found, status},
  }
}

function _updateSigID (sigID: SigID): UpdateSigID {
  return {
    type: Constants.updateSigID,
    payload: {sigID},
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

function updatePgpInfo (pgpInfo: $Shape<PgpInfo>): UpdatePgpInfo {
  return {
    type: Constants.updatePgpInfo,
    payload: pgpInfo,
    skipLogging: true,
  }
}

function submitBTCAddress (): AsyncAction {
  return (dispatch, getState) => {
    dispatch(_cleanupUsername())
    BTCRegisterBTCRpc({
      ..._makeWaitingHandler(dispatch),
      param: {
        address: getState().profile.username,
        force: true,
      },
      callback: (error) => {
        if (error) {
          console.warn('Error making proof')
          dispatch(_updateErrorText(error.raw.desc, error.raw.code))
        } else {
          dispatch(_updateProofStatus(true, proveCommon.ProofStatus.ok))
          dispatch(navigateTo([{path: 'ConfirmOrPending'}], profileTab))
        }
      },
    })
  }
}

function _addServiceProof (service: ProvablePlatformsType): AsyncAction {
  return (dispatch) => {
    proveStartProofRpc({
      ..._makeWaitingHandler(dispatch),
      param: {
        service,
        username: '',
        force: true,
        promptPosted: false,
        auto: false,
      },
      incomingCallMap: {
        'keybase.1.proveUi.promptUsername': ({prompt, prevError}, response) => {
          promptUsernameResponse = response
          if (prevError) {
            dispatch(_updateErrorText(prevError.desc, prevError.code))
          }
          dispatch(navigateTo([{path: 'ProveEnterUsername'}], profileTab))
        },
        'keybase.1.proveUi.outputInstructions': ({instructions, proof}, response) => {
          if (service === 'dnsOrGenericWebSite') { // We don't get this directly (yet) so we parse this out
            try {
              const match = instructions.data.match(/<url>(http[s]+):\/\//)
              const protocol = match && match[1]
              updatePlatform(protocol === 'https' ? 'https' : 'http')
            } catch (_) {
              updatePlatform('http')
            }
          }

          dispatch(_updateProofText(proof))
          outputInstructionsResponse = response
          dispatch(navigateTo([{path: 'PostProof'}], profileTab))
        },
        'keybase.1.proveUi.promptOverwrite': (_, response) => { response.result(true) },
        'keybase.1.proveUi.outputPrechecks': (_, response) => { response.result() },
        'keybase.1.proveUi.preProofWarning': (_, response) => { response.result(true) },
        'keybase.1.proveUi.okToCheck': (_, response) => { response.result(true) },
        'keybase.1.proveUi.displayRecheckWarning': (_, response) => { response.result() },
      },
      callback: (error, {sigID}) => {
        dispatch(_updateSigID(sigID))

        if (error) {
          console.warn('Error making proof')
          dispatch(_updateErrorText(error.raw.desc, error.raw.code))
        } else {
          console.log('Start Proof done: ', sigID)
          dispatch(checkProof())
        }
      },
    })
  }
}

function addProof (platform: PlatformsExpandedType): AsyncAction {
  return (dispatch) => {
    dispatch(updatePlatform(platform))
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

function _revokedWaitingForResponse (waiting: boolean): WaitingRevokeProof {
  return {
    type: Constants.waitingRevokeProof,
    payload: {waiting},
  }
}

function _revokedErrorResponse (error: string): FinishRevokeProof {
  return {
    type: Constants.finishRevokeProof,
    payload: {error},
    error: true,
  }
}

function _makeRevokeWaitingHandler (dispatch: Dispatch): {waitingHandler: (waiting: boolean) => void} {
  return {
    waitingHandler: bindActionCreators(_revokedWaitingForResponse, dispatch),
  }
}

function _revokedFinishResponse (): FinishRevokeProof {
  return {
    type: Constants.finishRevokeProof,
    payload: undefined,
    error: false,
  }
}

function finishRevoking (): AsyncAction {
  return (dispatch) => {
    dispatch(_revokedFinishResponse())
    dispatch(navigateUp())
  }
}

function submitRevokeProof (proofId: string): AsyncAction {
  return (dispatch) => {
    revokeRevokeSigsRpc({
      ..._makeRevokeWaitingHandler(dispatch),
      param: {
        sigIDQueries: [proofId],
      },
      incomingCallMap: { },
      callback: error => {
        if (error) {
          console.warn(`Error when revoking proof ${proofId}`, error)
          dispatch(_revokedErrorResponse('There was an error revoking your proof. You can click the button to try again.'))
        } else {
          dispatch(finishRevoking())
        }
      },
    })
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
    if (outputInstructionsResponse) {
      outputInstructionsResponse.result()
      outputInstructionsResponse = null
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
            if (!found && status >= proveCommon.ProofStatus.baseHardError) {
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

function outputInstructionsActionLink (): AsyncAction {
  return (dispatch, getState) => {
    const profile = getState().profile
    switch (profile.platform) {
      case 'coinbase':
        openURL(`https://coinbase.com/${profile.username}#settings`)
        break
      case 'twitter':
        openURL(`https://twitter.com/home?status=${profile.proof}`)
        break
      case 'github':
        openURL('https://gist.github.com/')
        break
      case 'reddit':
        openURL(profile.proof)
        break
      default:
        break
    }
  }
}

function backToProfile (): AsyncAction {
  return (dispatch) => {
    dispatch(getMyProfile())
    dispatch(navigateUp())
  }
}

type PgpInfoError = {
  errorText: ?string,
  errorEmail1: boolean,
  errorEmail2: boolean,
  errorEmail3: boolean,
}

function generatePgp (): GeneratePgp {
  return {
    type: Constants.generatePgp,
    payload: undefined,
  }
}

function dropPgp (kid: KID): DropPgp {
  return {
    type: Constants.dropPgp,
    payload: {kid},
  }
}

// This can be replaced with something that makes a call to service to validate
function checkPgpInfoForErrors (pgpInfo: PgpInfo): PgpInfoError {
  const errorEmail1 = (pgpInfo.email1 && isValidEmail(pgpInfo.email1))
  const errorEmail2 = (pgpInfo.email2 && isValidEmail(pgpInfo.email2))
  const errorEmail3 = (pgpInfo.email3 && isValidEmail(pgpInfo.email3))

  return {
    errorText: isValidName(pgpInfo.fullName) || errorEmail1 || errorEmail2 || errorEmail3,
    errorEmail1: !!errorEmail1,
    errorEmail2: !!errorEmail2,
    errorEmail3: !!errorEmail3,
  }
}

// Returns the promise of the string that represents the public key
function generatePgpKey (pgpInfo: PgpInfo): Promise<string> {
  const identities = [pgpInfo.email1, pgpInfo.email2, pgpInfo.email3].map(email => ({
    username: pgpInfo.fullName || '',
    comment: '',
    email: email || '',
  }))

  return new Promise((resolve, reject) => {
    pgpPgpKeyGenRpc({
      param: {
        // TODO (mm) we shouldn't be setting these values...
        primaryBits: 4096,
        subkeyBits: 4096,
        createUids: {
          useDefault: false,
          ids: identities,
        },
        allowMulti: false,
        doExport: false,
        pushSecret: false,
      },
      callback: (err) => {
        // TODO handle error
        if (err) {
          reject(err)
          return
        }
        resolve('TODO')
      },
    })
  })
}

// Resolves if the pgp key was dropped successfully
function dropPgpWithService (keyID: KID): Promise<void> {
  return new Promise((resolve, reject) => {
    revokeRevokeKeyRpc({
      param: {keyID},
      callback: (err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      },
    })
  })
}

function * checkPgpInfo (action: UpdatePgpInfo): SagaGenerator<any, any> {
  if (action.error) { return }

  // $ForceType
  const pgpInfo: PgpInfo = yield select(({profile: {pgpInfo}}: TypedState) => pgpInfo)

  const errorUpdateAction: UpdatePgpInfo = {
    type: Constants.updatePgpInfo,
    error: true,
    skipLogging: true,
    payload: checkPgpInfoForErrors(pgpInfo),
  }

  yield put(errorUpdateAction)
}

// TODO(mm) handle error
function * dropPgpSaga (action: DropPgp): SagaGenerator<any, any> {
  if (action.error) { return }

  const kid = action.payload.kid

  try {
    yield put(_revokedWaitingForResponse(true))
    yield call(dropPgpWithService, kid)
    yield put(_revokedWaitingForResponse(false))
    yield put(navigateTo([]))
  } catch (e) {
    yield put(_revokedWaitingForResponse(false))
    yield put(_revokedErrorResponse(`Error in dropping Pgp Key: ${e}`))
    console.log('error in dropping pgp key', e)
  }
}

// TODO(mm) handle error
function * generatePgpSaga (): SagaGenerator<any, any> {
  yield put(routeAppend('generate'))

  // $ForceType
  const pgpInfo: PgpInfo = yield select(({profile: {pgpInfo}}: TypedState) => pgpInfo)

  try {
    const publicKey = yield call(generatePgpKey, pgpInfo)
    yield put({type: Constants.updatePgpPublicKey, payload: {publicKey}})
    yield put(routeAppend('finished'))

    // $ForceType
    const finishedAction: FinishedWithKeyGen = yield take(Constants.finishedWithKeyGen)

    yield put(navigateTo([]))
    console.log('TODO: do something with:', finishedAction.payload)
  } catch (e) {
    console.log('error in generating pgp key', e)
  }
}

function * pgpSaga (): SagaGenerator<any, any> {
  yield [
    takeLatest(a => (a && a.type === Constants.updatePgpInfo && !a.error), checkPgpInfo),
    takeLatest(Constants.generatePgp, generatePgpSaga),
    takeEvery(Constants.dropPgp, dropPgpSaga),
  ]
}

function * profileSaga (): SagaGenerator<any, any> {
  yield [
    call(pgpSaga),
  ]
}

export {
  addProof,
  backToProfile,
  cancelAddProof,
  checkProof,
  checkSpecificProof,
  dropPgp,
  editProfile,
  finishRevoking,
  generatePgp,
  outputInstructionsActionLink,
  submitBTCAddress,
  submitRevokeProof,
  submitUsername,
  updatePgpInfo,
  updatePlatform,
  updateUsername,
}

export default profileSaga
