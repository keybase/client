// @flow
import * as Constants from '../../constants/profile'
import keybaseUrl from '../../constants/urls'
import openURL from '../../util/open-url'
import {addProof, checkProof, cancelAddProof, submitUsername, submitBTCAddress, proofsSaga, submitZcashAddress} from './proofs'
import {call, put, select} from 'redux-saga/effects'
import {getMyProfile} from '.././tracker'
import {navigateAppend, navigateTo, navigateUp, switchTo} from '../../actions/route-tree'
import {pgpSaga, dropPgp, generatePgp, updatePgpInfo} from './pgp'
import {profileTab} from '../../constants/tabs'
import {revokeRevokeSigsRpcPromise, userProfileEditRpcPromise} from '../../constants/types/flow-types'
import {safeTakeEvery} from '../../util/saga'

import type {BackToProfile, EditProfile, FinishRevokeProof, FinishRevoking, OnClickAvatar, OnClickFollowers, OnClickFollowing, OnUserClick, OutputInstructionsActionLink, State, SubmitRevokeProof, UpdateUsername, WaitingRevokeProof} from '../../constants/profile'
import type {SagaGenerator} from '../../constants/types/saga'
import type {TypedState} from '../../constants/reducer'
import type {AppLink} from '../../constants/app'

function editProfile (bio: string, fullName: string, location: string): EditProfile {
  return {payload: {bio, fullName, location}, type: Constants.editProfile}
}

function * _editProfile (action: EditProfile): SagaGenerator<any, any> {
  const {bio, fullName, location} = action.payload
  yield call(userProfileEditRpcPromise, {
    param: {bio, fullName, location},
  })
  yield put(navigateUp())
}

function updateUsername (username: string): UpdateUsername {
  return {payload: {username}, type: Constants.updateUsername}
}

function _revokedWaitingForResponse (waiting: boolean): WaitingRevokeProof {
  return {payload: {waiting}, type: Constants.waitingRevokeProof}
}

function _revokedErrorResponse (error: string): FinishRevokeProof {
  return {error: true, payload: {error}, type: Constants.finishRevokeProof}
}

function _revokedFinishResponse (): FinishRevokeProof {
  return {payload: undefined, type: Constants.finishRevokeProof}
}

function finishRevoking (): FinishRevoking {
  return {payload: undefined, type: Constants.finishRevoking}
}

function * _finishRevoking (): SagaGenerator<any, any> {
  yield put(getMyProfile(true))
  yield put(_revokedFinishResponse())
  yield put(navigateUp())
}

function onUserClick (username: string): OnUserClick {
  return {payload: {username}, type: Constants.onUserClick}
}

function * _onUserClick (action: OnUserClick): SagaGenerator<any, any> {
  const {username} = action.payload
  yield put(switchTo([profileTab]))
  yield put(navigateAppend([{props: {username}, selected: 'profile'}], [profileTab]))
}

function onClickAvatar (username: string, openWebsite?: boolean): OnClickAvatar {
  return {
    payload: {
      openWebsite,
      username,
    },
    type: Constants.onClickAvatar,
  }
}

function * _onClickAvatar (action: OnClickFollowers): SagaGenerator<any, any> {
  if (!action.payload.username) {
    return
  }

  if (!action.openWebsite) {
    // TODO(mm) hint followings
    yield put(onUserClick(action.payload.username))
  } else {
    yield call(openURL, `${keybaseUrl}/${action.payload.username}`)
  }
}

function onClickFollowers (username: string, openWebsite?: boolean): OnClickFollowers {
  return {
    payload: {
      openWebsite,
      username,
    },
    type: Constants.onClickFollowers,
  }
}

function * _onClickFollowers (action: OnClickFollowers): SagaGenerator<any, any> {
  if (!action.payload.username) {
    return
  }

  if (!action.openWebsite) {
    // TODO(mm) hint followings
    yield put(onUserClick(action.payload.username))
  } else {
    yield call(openURL, `${keybaseUrl}/${action.payload.username}#profile-tracking-section`)
  }
}

function onClickFollowing (username: string, openWebsite?: boolean): OnClickFollowing {
  return {
    payload: {
      openWebsite,
      username,
    },
    type: Constants.onClickFollowing,
  }
}

function * _onClickFollowing (action: OnClickFollowing): SagaGenerator<any, any> {
  if (!action.payload.username) {
    return
  }

  if (!action.openWebsite) {
    // TODO(mm) hint followings
    yield put(onUserClick(action.payload.username))
  } else {
    yield call(openURL, `${keybaseUrl}/${action.payload.username}#profile-tracking-section`)
  }
}

function submitRevokeProof (proofId: string): SubmitRevokeProof {
  return {payload: {proofId}, type: Constants.submitRevokeProof}
}

function * _submitRevokeProof (action: SubmitRevokeProof): SagaGenerator<any, any> {
  try {
    yield put(_revokedWaitingForResponse(true))
    yield call(revokeRevokeSigsRpcPromise, {param: {sigIDQueries: [action.payload.proofId]}})
    yield put(_revokedWaitingForResponse(false))

    yield put(finishRevoking())
  } catch (error) {
    console.warn(`Error when revoking proof ${action.payload.proofId}`, error)
    yield put(_revokedWaitingForResponse(false))
    yield put(_revokedErrorResponse('There was an error revoking your proof. You can click the button to try again.'))
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
  return {payload: undefined, type: Constants.outputInstructionsActionLink}
}

function * _onAppLink (action: AppLink): SagaGenerator<any, any> {
  // if (action.payload.link
  console.log('bbb', action)
}

function * _outputInstructionsActionLink (): SagaGenerator<any, any> {
  const getProfile = (state: TypedState) => state.profile
  const profile: State = ((yield select(getProfile)): any)

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
    case 'hackernews':
      yield call(openURL, `https://news.ycombinator.com/user?id=${profile.username}`)
      break
    default:
      break
  }
}

function backToProfile (): BackToProfile {
  return {payload: undefined, type: Constants.backToProfile}
}

function * _backToProfile (): SagaGenerator<any, any> {
  yield put(getMyProfile())
  yield put(navigateTo([], [profileTab]))
}

function * _profileSaga (): SagaGenerator<any, any> {
  yield [
    safeTakeEvery(Constants.backToProfile, _backToProfile),
    safeTakeEvery(Constants.editProfile, _editProfile),
    safeTakeEvery(Constants.finishRevoking, _finishRevoking),
    safeTakeEvery(Constants.onClickAvatar, _onClickAvatar),
    safeTakeEvery(Constants.onClickFollowers, _onClickFollowers),
    safeTakeEvery(Constants.onClickFollowing, _onClickFollowing),
    safeTakeEvery(Constants.onUserClick, _onUserClick),
    safeTakeEvery(Constants.outputInstructionsActionLink, _outputInstructionsActionLink),
    safeTakeEvery(Constants.submitRevokeProof, _submitRevokeProof),
    safeTakeEvery('app:link', _onAppLink),
  ]
}

function * profileSaga (): SagaGenerator<any, any> {
  yield [
    call(_profileSaga),
    call(pgpSaga),
    call(proofsSaga),
  ]
}

export {
  addProof,
  backToProfile,
  cancelAddProof,
  checkProof,
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
  submitZcashAddress,
  submitRevokeProof,
  submitUsername,
  updatePgpInfo,
  updateUsername,
}

export default profileSaga
