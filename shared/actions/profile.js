// @flow
import * as Constants from '../constants/profile'
import engine from '../engine'
import type {Dispatch, AsyncAction} from '../constants/types/flux'
import type {PlatformsExpanded} from '../constants/types/more'
import type {UpdateUsername, UpdatePlatform, Waiting} from '../constants/profile'
import {apiserverPostRpc, proveStartProofRpc} from '../constants/types/flow-types'
import {bindActionCreators} from 'redux'
import {constants as RpcConstants} from '../constants/types/keybase-v1'
import {navigateUp, routeAppend} from '../actions/router'

const InputCancelError = {desc: 'Cancel Add Proof', code: RpcConstants.StatusCode.scinputcanceled}

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

let submitUsernameResponse: ?Object = null

function submitUsername (): AsyncAction {
  return (dispatch, getState) => {
    if (submitUsernameResponse) {
      submitUsernameResponse.result(getState().profile.username)
      submitUsernameResponse = null
    }
  }
}

function updateUsername (username: string): UpdateUsername {
  return {
    type: Constants.updateUsername,
    payload: {username},
  }
}

function cancelAddProof () : AsyncAction {
  return (dispatch) => {
    if (submitUsernameResponse) {
      engine.cancelRPC(submitUsernameResponse, InputCancelError)
      submitUsernameResponse = null
    }
    dispatch(navigateUp())
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
          submitUsernameResponse = response
          dispatch(routeAppend({path: 'ProveEnterUsername'}))
        },
      },
      callback: (error, {sigID}) => {
        if (error) {
          console.warn('Error making proof')
          // TODO dispatch error
        }
        console.log('Proof done: ', sigID)
        dispatch(navigateUp())
      },
    })
  }
}

export {
  addProof,
  editProfile,
  selectPlatform,
  updateUsername,
  submitUsername,
  cancelAddProof,
}
