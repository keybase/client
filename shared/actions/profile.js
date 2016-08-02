// @flow
import * as Constants from '../constants/profile'
import engine from '../engine'
import type {Dispatch, AsyncAction} from '../constants/types/flux'
import type {PlatformsExpanded} from '../constants/types/more'
import type {SigID} from '../constants/types/flow-types'
import type {UpdateUsername, UpdatePlatform, Waiting, UpdateProofText, UpdateError, UpdateProofStatus, UpdateSigID} from '../constants/profile'
import {apiserverPostRpc, proveStartProofRpc, proveCheckProofRpc} from '../constants/types/flow-types'
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

function selectPlatform (platform: PlatformsExpanded): UpdatePlatform {
  return {
    type: Constants.updatePlatform,
    payload: {platform},
  }
}

function submitUsername (): AsyncAction {
  return (dispatch, getState) => {
    if (promptUsernameResponse) {
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

function updateError (error: string): UpdateError {
  return {
    type: Constants.updateError,
    payload: {error},
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

function addProof (platform: PlatformsExpanded): AsyncAction {
  return (dispatch) => {
    dispatch(selectPlatform(platform))

    proveStartProofRpc({
      ...makeWaitingHandler(dispatch),
      param: {
        service: platform,
        username: '',
        force: true,
        promptPosted: false,
        auto: false,
      },
      incomingCallMap: {
        'keybase.1.proveUi.promptUsername': ({prompt, prevError}, response) => {
          promptUsernameResponse = response
          dispatch(navigateTo([{path: 'ProveEnterUsername'}], profileTab))
        },
        'keybase.1.proveUi.outputInstructions': ({instructions, proof}, response) => {
          dispatch(updateProofText(proof))
          outputInstructionsResponse = response
          dispatch(navigateTo([{path: 'PostProof'}], profileTab))
        },
      },
      callback: (error, {sigID}) => {
        dispatch(updateSigID(sigID))

        if (error) {
          console.warn('Error making proof')
          dispatch(updateError(error))
        } else {
          console.log('Start Proof done: ', sigID)
          dispatch(checkProof())
        }
      },
    })
  }
}

function checkProof (): AsyncAction {
  return (dispatch, getState) => {
    // The first 'check for it' call happens as part of the incomingCallMap above. If that fails we can try again here
    if (outputInstructionsResponse) {
      outputInstructionsResponse.result()
      outputInstructionsResponse = null
    }

    proveCheckProofRpc({
      ...makeWaitingHandler(dispatch),
      param: {
        sigID: getState().profile.sigID,
      },
      callback: (error, {found, status}) => {
        if (error) {
          console.warn('Error getting proof update')
          dispatch(updateError(`We couldn't verify your proof (${error}). Please retry!`))
        } else {
          if (!found || status !== proveCommon.ProofStatus.ok) {
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
  editProfile,
  outputInstructionsActionLink,
  selectPlatform,
  submitUsername,
  updateUsername,
  reloadProfile,
  checkProof,
}
