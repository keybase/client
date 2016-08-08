// @flow
import * as Constants from '../constants/profile'
import engine from '../engine'
import type {Dispatch, AsyncAction} from '../constants/types/flux'
import type {PlatformsExpandedType, ProvablePlatformsType} from '../constants/types/more'
import type {SigID} from '../constants/types/flow-types'
import type {UpdateUsername, UpdatePlatform, Waiting, UpdateProofText, UpdateError, UpdateProofStatus,
  UpdateSigID, WaitingRevokeProof, FinishRevokeProof} from '../constants/profile'
import {apiserverPostRpc, proveStartProofRpc, proveCheckProofRpc, revokeRevokeSigsRpc, BTCRegisterBTCRpc} from '../constants/types/flow-types'
import {bindActionCreators} from 'redux'
import {constants as RpcConstants, proveCommon} from '../constants/types/keybase-v1'
import {getMyProfile} from './tracker'
import {navigateUp, navigateTo} from '../actions/router'
import {profileTab} from '../constants/tabs'
import {shell} from 'electron'

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

function makeWaitingHandler (dispatch: Dispatch): {waitingHandler: (waiting: boolean) => void} {
  return {
    waitingHandler: bindActionCreators(waitingForResponse, dispatch),
  }
}

function waitingForResponse (waiting: boolean): Waiting {
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

function submitUsername (): AsyncAction {
  return (dispatch, getState) => {
    if (promptUsernameResponse) {
      dispatch(updateError(null))
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
    dispatch(updateError(null))
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

function updateProofText (proof: string): UpdateProofText {
  return {
    type: Constants.updateProofText,
    payload: {proof},
  }
}

function updateError (error: ?string, code: ?number): UpdateError {
  // Flow needs this for some reason instead of default params
  if (code === undefined || code === null) {
    code = -1
  }

  return {
    type: Constants.updateError,
    payload: {error, errorCode: code},
  }
}

function updateProofStatus (found, status): UpdateProofStatus {
  return {
    type: Constants.updateProofStatus,
    payload: {found, status},
  }
}

function updateSigID (sigID: SigID): UpdateSigID {
  return {
    type: Constants.updateSigID,
    payload: {sigID},
  }
}

function askTextOrDNS (): AsyncAction {
  return (dispatch) => {
    const replace = 'dns'
    console.warn(`TEMP hardcoded to using ${replace} proof for all web`)
    // really show the screen then have that do addProof
    dispatch(addProof(replace)) // TEMP hardcoded
  }
}

function registerBTC (): AsyncAction {
  return (dispatch) => {
    dispatch(navigateTo([{path: 'ProveEnterUsername'}], profileTab))
  }
}

function submitBTCAddress (): AsyncAction {
  return (dispatch, getState) => {
    BTCRegisterBTCRpc({
      ...makeWaitingHandler(dispatch),
      param: {
        address: getState().profile.username,
        force: true,
      },
      callback: (error) => {
        if (error) {
          console.warn('Error making proof')
          dispatch(updateError(error.raw.desc, error.raw.code))
        } else {
          dispatch(updateProofStatus(true, proveCommon.ProofStatus.ok))
          dispatch(navigateTo([{path: 'ConfirmOrPending'}], profileTab))
        }
      },
    })
  }
}

function addServiceProof (service: ProvablePlatformsType): AsyncAction {
  return (dispatch) => {
    proveStartProofRpc({
      ...makeWaitingHandler(dispatch),
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
            dispatch(updateError(prevError.desc, prevError.code))
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

          dispatch(updateProofText(proof))
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
        dispatch(updateSigID(sigID))

        if (error) {
          console.warn('Error making proof')
          dispatch(updateError(error.raw.desc, error.raw.code))
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
    dispatch(updateError(null))

    // Special cases
    switch (platform) {
      case 'dnsOrGenericWebSite':
        dispatch(askTextOrDNS())
        break
      case 'btc':
        dispatch(registerBTC())
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
        dispatch(addServiceProof(platform))
    }
  }
}

function revokedWaitingForResponse (waiting: boolean): WaitingRevokeProof {
  return {
    type: Constants.waitingRevokeProof,
    payload: {waiting},
  }
}

function revokedErrorResponse (error: string): FinishRevokeProof {
  return {
    type: Constants.finishRevokeProof,
    payload: {error},
    error: true,
  }
}

function makeRevokeWaitingHandler (dispatch: Dispatch): {waitingHandler: (waiting: boolean) => void} {
  return {
    waitingHandler: bindActionCreators(revokedWaitingForResponse, dispatch),
  }
}

function revokedFinishResponse (): FinishRevokeProof {
  return {
    type: Constants.finishRevokeProof,
    payload: undefined,
    error: false,
  }
}

function finishRevoking (): AsyncAction {
  return (dispatch) => {
    dispatch(revokedFinishResponse())
    dispatch(navigateUp())
  }
}

function submitRevokeProof (proofId: string): AsyncAction {
  return (dispatch) => {
    revokeRevokeSigsRpc({
      ...makeRevokeWaitingHandler(dispatch),
      param: {
        sigIDQueries: [proofId],
      },
      incomingCallMap: { },
      callback: error => {
        if (error) {
          console.warn(`Error when revoking proof ${proofId}`, error)
          dispatch(revokedErrorResponse('There was an error revoking your proof. You can click the button to try again.'))
        } else {
          dispatch(finishRevoking())
        }
      },
    })
  }
}

function checkProof (): AsyncAction {
  return (dispatch, getState) => {
    dispatch(updateError(null))
    const sigID = getState().profile.sigID

    // The initial checkProof() call happens while we're in the middle of the incomingCallMap flow. That can error out
    // and we can call this again. This if case is when we're in the incomingCallMap
    if (outputInstructionsResponse) {
      outputInstructionsResponse.result()
      outputInstructionsResponse = null

      return // the proveStartProofRpc will call checkProof after we respond to outputInstructionsResponse automatically
    }

    proveCheckProofRpc({
      ...makeWaitingHandler(dispatch),
      param: {
        sigID,
      },
      callback: (error, {found, status}) => {
        if (error) {
          console.warn('Error getting proof update')
          dispatch(updateError("We couldn't verify your proof. Please retry!"))
        } else {
          // this enum value is the divider between soft and hard errors
          if (!found && status >= proveCommon.ProofStatus.baseHardError) {
            dispatch(updateError("We couldn't find your proof. Please retry!"))
          } else {
            dispatch(updateProofStatus(found, status))
            dispatch(navigateTo([{path: 'ConfirmOrPending'}], profileTab))
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
        shell.openExternal(`https://coinbase.com/${profile.username}#settings`)
        break
      case 'twitter':
        shell.openExternal(`https://twitter.com/home?status=${profile.proof}`)
        break
      case 'github':
        shell.openExternal('https://gist.github.com/')
        break
      case 'reddit':
        shell.openExternal(profile.proof)
        break
      default:
        break
    }
  }
}

function reloadProfile (): AsyncAction {
  return (dispatch) => {
    dispatch(getMyProfile())
    dispatch(navigateUp())
  }
}

export {
  addProof,
  cancelAddProof,
  checkProof,
  editProfile,
  finishRevoking,
  outputInstructionsActionLink,
  reloadProfile,
  submitBTCAddress,
  submitRevokeProof,
  submitUsername,
  updatePlatform,
  updateUsername,
}
