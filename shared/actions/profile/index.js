// @flow
import * as Constants from '../../constants/profile'
import flags from '../../util/feature-flags'
import keybaseUrl from '../../constants/urls'
import openURL from '../../util/open-url'
import {addProof, checkProof, cancelAddProof, submitUsername, submitBTCAddress, checkSpecificProof} from './proofs'
import {apiserverPostRpc, revokeRevokeSigsRpc} from '../../constants/types/flow-types'
import {call, put, select} from 'redux-saga/effects'
import {getMyProfile} from '.././tracker'
import {navigateUp, routeAppend, switchTab} from '../../actions/router'
import {pgpSaga, dropPgp, generatePgp, updatePgpInfo} from './pgp'
import {profileTab} from '../../constants/tabs'
import {takeEvery} from 'redux-saga'

import type {Dispatch, AsyncAction} from '../../constants/types/flux'
import type {SagaGenerator} from '../../constants/types/saga'
import type {TypedState}  from '../../constants/reducer'
import type {UpdateUsername, WaitingRevokeProof, FinishRevokeProof, BackToProfile, OutputInstructionsActionLink, State, OnClickFollowing, OnClickFollowers, OnClickAvatar} from '../../constants/profile'

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

function updateUsername (username: string): UpdateUsername {
  return {
    type: Constants.updateUsername,
    payload: {username},
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
    waitingHandler: (waiting: boolean) => { dispatch(_revokedWaitingForResponse(waiting)) },
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
    dispatch(getMyProfile(true))
    dispatch(_revokedFinishResponse())
    dispatch(navigateUp())
  }
}

function onUserClick (username: string, uid: string): AsyncAction {
  return dispatch => {
    dispatch(routeAppend({path: 'profile', userOverride: {username, uid}}, profileTab))
    dispatch(switchTab(profileTab))
  }
}

function onClickAvatar (username: ?string, uid: string, openWebsite?: boolean): OnClickAvatar {
  return {
    type: Constants.onClickAvatar,
    payload: {
      username,
      uid,
      openWebsite,
    },
  }
}

function * _onClickAvatar (action: OnClickFollowers): SagaGenerator<any, any> {
  if (!action.payload.username) {
    return
  }

  if (!action.openWebsite && flags.tabProfileEnabled === true) {
    // TODO(mm) hint followings
    yield put(onUserClick(action.payload.username, action.payload.uid))
  } else {
    yield call(openURL, `${keybaseUrl}/${action.payload.username}`)
  }
}

function onClickFollowers (username: ?string, uid: string, openWebsite?: boolean): OnClickFollowers {
  return {
    type: Constants.onClickFollowers,
    payload: {
      username,
      uid,
      openWebsite,
    },
  }
}

function * _onClickFollowers (action: OnClickFollowers): SagaGenerator<any, any> {
  if (!action.payload.username) {
    return
  }

  if (!action.openWebsite && flags.tabProfileEnabled === true) {
    // TODO(mm) hint followings
    yield put(onUserClick(action.payload.username, action.payload.uid))
  } else {
    yield call(openURL, `${keybaseUrl}/${action.payload.username}#profile-tracking-section`)
  }
}

function onClickFollowing (username: ?string, uid: string, openWebsite?: boolean): OnClickFollowing {
  return {
    type: Constants.onClickFollowing,
    payload: {
      username,
      uid,
      openWebsite,
    },
  }
}

function * _onClickFollowing (action: OnClickFollowing): SagaGenerator<any, any> {
  if (!action.payload.username) {
    return
  }

  if (!action.openWebsite && flags.tabProfileEnabled === true) {
    // TODO(mm) hint followings
    yield put(onUserClick(action.payload.username, action.payload.uid))
  } else {
    yield call(openURL, `${keybaseUrl}/${action.payload.username}#profile-tracking-section`)
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

function _openURLIfNotNull (nullableThing, url, metaText) {
  if (nullableThing == null) {
    console.warn("Can't openURL because we have a null", metaText)
    return
  }
  openURL(url)
}

function outputInstructionsActionLink (): OutputInstructionsActionLink {
  return {type: Constants.outputInstructionsActionLink, payload: undefined}
}

function * _outputInstructionsActionLink (): SagaGenerator<any, any> {
  // $FlowIssue @marco dunno why this isn't working
  const profile: State = yield select((state: TypedState) => state.profile)
  switch (profile.platform) {
    case 'coinbase':
      yield call(openURL, `https://coinbase.com/${profile.username}#settings`)
      break
    case 'twitter':
      yield call(_openURLIfNotNull, profile.proofText, `https://twitter.com/home?status=${profile.proofText || ''}`, 'twitter url')
      break
    case 'github':
      yield call(openURL, 'https://gist.github.com/')
      break
    case 'reddit':
      yield call(_openURLIfNotNull, profile.proofText, profile.proofText, 'reddit url')
      break
    case 'facebook':
      yield call(_openURLIfNotNull, profile.proofText, profile.proofText, 'facebook url')
      break
    default:
      break
  }
}

function backToProfile (): BackToProfile {
  return {type: Constants.backToProfile, payload: undefined}
}

function * _backToProfile (): SagaGenerator<any, any> {
  yield put(getMyProfile())
  yield put(navigateUp())
}

function * _profileSaga (): SagaGenerator<any, any> {
  yield [
    takeEvery(Constants.backToProfile, _backToProfile),
    takeEvery(Constants.outputInstructionsActionLink, _outputInstructionsActionLink),
    takeEvery(Constants.onClickFollowing, _onClickFollowing),
    takeEvery(Constants.onClickFollowers, _onClickFollowers),
    takeEvery(Constants.onClickAvatar, _onClickAvatar),
  ]
}

function * profileSaga (): SagaGenerator<any, any> {
  yield [
    call(_profileSaga),
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
  onClickAvatar,
  onClickFollowers,
  onClickFollowing,
  onUserClick,
  outputInstructionsActionLink,
  submitBTCAddress,
  submitRevokeProof,
  submitUsername,
  updatePgpInfo,
  updateUsername,
}

export default profileSaga
