// @flow
import * as Constants from '../../constants/profile'
import flags from '../../util/feature-flags'
import keybaseUrl from '../../constants/urls'
import openURL from '../../util/open-url'
import {addProof, checkProof, cancelAddProof, submitUsername, submitBTCAddress, proofsSaga, submitZcashAddress} from './proofs'
import {apiserverPostRpcPromise, revokeRevokeSigsRpcPromise} from '../../constants/types/flow-types'
import {call, put, select} from 'redux-saga/effects'
import {getMyProfile} from '.././tracker'
import {navigateAppend, navigateTo, navigateUp, switchTo} from '../../actions/route-tree'
import {pgpSaga, dropPgp, generatePgp, updatePgpInfo} from './pgp'
import {profileTab} from '../../constants/tabs'
import {safeTakeEvery} from '../../util/saga'

import type {BackToProfile, EditProfile, FinishRevokeProof, FinishRevoking, OnClickAvatar, OnClickFollowers, OnClickFollowing, OnUserClick, OutputInstructionsActionLink, State, SubmitRevokeProof, UpdateUsername, WaitingRevokeProof} from '../../constants/profile'
import type {SagaGenerator} from '../../constants/types/saga'
import type {TypedState} from '../../constants/reducer'

function editProfile (bio: string, fullname: string, location: string): EditProfile {
  return {type: Constants.editProfile, payload: {bio, fullname, location}}
}

function * _editProfile (action: EditProfile): SagaGenerator<any, any> {
  try {
    yield call(apiserverPostRpcPromise, {
      param: {
        endpoint: 'profile-edit',
        args: [
          {key: 'bio', value: action.payload.bio},
          {key: 'full_name', value: action.payload.fullname},
          {key: 'location', value: action.payload.location},
        ],
      },
    })

    yield put(navigateUp())
  } catch (_) { }
}

function updateUsername (username: string): UpdateUsername {
  return {type: Constants.updateUsername, payload: {username}}
}

function _revokedWaitingForResponse (waiting: boolean): WaitingRevokeProof {
  return {type: Constants.waitingRevokeProof, payload: {waiting}}
}

function _revokedErrorResponse (error: string): FinishRevokeProof {
  return {type: Constants.finishRevokeProof, payload: {error}, error: true}
}

function _revokedFinishResponse (): FinishRevokeProof {
  return {type: Constants.finishRevokeProof, payload: undefined}
}

function finishRevoking (): FinishRevoking {
  return {type: Constants.finishRevoking, payload: undefined}
}

function * _finishRevoking (): SagaGenerator<any, any> {
  yield put(getMyProfile(true))
  yield put(_revokedFinishResponse())
  yield put(navigateUp())
}

function onUserClick (username: string, uid: string): OnUserClick {
  return {type: Constants.onUserClick, payload: {username, uid}}
}

function * _onUserClick (action: OnUserClick): SagaGenerator<any, any> {
  const {username, uid} = action.payload
  yield put(switchTo([profileTab]))
  yield put(navigateAppend([{selected: 'profile', username, uid}], [profileTab]))
}

function onClickAvatar (username: ?string, uid: string, openWebsite?: boolean): OnClickAvatar {
  return {
    type: Constants.onClickAvatar,
    payload: {username, uid, openWebsite},
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
    payload: {username, uid, openWebsite},
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

function submitRevokeProof (proofId: string): SubmitRevokeProof {
  return {type: Constants.submitRevokeProof, payload: {proofId}}
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
  return {type: Constants.outputInstructionsActionLink, payload: undefined}
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
  return {type: Constants.backToProfile, payload: undefined}
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
