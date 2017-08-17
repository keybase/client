// @flow
import * as Constants from '../../constants/profile'
import keybaseUrl from '../../constants/urls'
import openURL from '../../util/open-url'
import {
  addProof,
  checkProof,
  cancelAddProof,
  submitUsername,
  submitBTCAddress,
  proofsSaga,
  submitZcashAddress,
} from './proofs'
import {call, put, select, fork} from 'redux-saga/effects'
import {getMyProfile} from '.././tracker'
import {navigateAppend, navigateTo, navigateUp, switchTo, putActionIfOnPath} from '../../actions/route-tree'
import {pgpSaga, dropPgp, generatePgp, updatePgpInfo} from './pgp'
import {profileTab} from '../../constants/tabs'
import {revokeRevokeSigsRpcPromise, userProfileEditRpcPromise} from '../../constants/types/flow-types'
import {safeTakeEvery} from '../../util/saga'
import * as Selectors from '../../constants/selectors'

import type {SagaGenerator} from '../../constants/types/saga'
import type {TypedState} from '../../constants/reducer'
import type {AppLink} from '../../constants/app'
import {maybeUpgradeSearchResultIdToKeybaseId, serviceIdToService} from '../../constants/search'
import {parseUserId} from '../../util/platforms'

function editProfile(bio: string, fullName: string, location: string): Constants.EditProfile {
  return {payload: {bio, fullName, location}, type: Constants.editProfile}
}

const _editProfile = function*(action: Constants.EditProfile): SagaGenerator<any, any> {
  const {bio, fullName, location} = action.payload
  yield call(userProfileEditRpcPromise, {
    param: {bio, fullName, location},
  })
  // If the profile tab remained on the edit profile screen, navigate back to the top level.
  yield put(putActionIfOnPath([profileTab, 'editProfile'], navigateTo([], [profileTab]), [profileTab]))
}

function updateUsername(username: string): Constants.UpdateUsername {
  return {payload: {username}, type: Constants.updateUsername}
}

function _revokedWaitingForResponse(waiting: boolean): Constants.WaitingRevokeProof {
  return {payload: {waiting}, type: Constants.waitingRevokeProof}
}

function _revokedErrorResponse(error: string): Constants.FinishRevokeProof {
  return {error: true, payload: {error}, type: Constants.finishRevokeProof}
}

function _revokedFinishResponse(): Constants.FinishRevokeProof {
  return {payload: undefined, type: Constants.finishRevokeProof}
}

function finishRevoking(): Constants.FinishRevoking {
  return {payload: undefined, type: Constants.finishRevoking}
}

const _finishRevoking = function*(): SagaGenerator<any, any> {
  yield put(getMyProfile(true))
  yield put(_revokedFinishResponse())
  yield put(navigateUp())
}

function showUserProfile(username: string): Constants.ShowUserProfile {
  return {payload: {username}, type: Constants.showUserProfile}
}

const _showUserProfile = function*(action: Constants.ShowUserProfile): SagaGenerator<any, any> {
  const {username: userId} = action.payload
  const searchResultMap = yield select(Selectors.searchResultMapSelector)
  const username = maybeUpgradeSearchResultIdToKeybaseId(searchResultMap, userId)

  if (!username.includes('@')) {
    yield put(switchTo([profileTab]))
    yield put(navigateAppend([{props: {username}, selected: 'profile'}], [profileTab]))
    return
  }

  let props = {}
  const searchResult = yield select(Selectors.searchResultSelector, username)
  if (searchResult) {
    props = {
      fullname: searchResult.rightFullname,
      fullUsername: username,
      serviceName: searchResult.leftService,
      username: searchResult.leftUsername,
    }
  } else {
    const {username: parsedUsername, serviceId} = parseUserId(username)
    props = {
      fullUsername: username,
      serviceName: serviceIdToService(serviceId),
      username: parsedUsername,
    }
  }

  yield put(switchTo([profileTab]))
  yield put(navigateAppend([{props, selected: 'nonUserProfile'}], [profileTab]))
}

function onClickAvatar(username: string, openWebsite?: boolean): Constants.OnClickAvatar {
  return {
    payload: {
      openWebsite,
      username,
    },
    type: Constants.onClickAvatar,
  }
}

const _onClickAvatar = function*(action: Constants.OnClickFollowers): SagaGenerator<any, any> {
  if (!action.payload.username) {
    return
  }

  if (!action.openWebsite) {
    // TODO(mm) hint followings
    yield put(showUserProfile(action.payload.username))
  } else {
    yield call(openURL, `${keybaseUrl}/${action.payload.username}`)
  }
}

function onClickFollowers(username: string, openWebsite?: boolean): Constants.OnClickFollowers {
  return {
    payload: {
      openWebsite,
      username,
    },
    type: Constants.onClickFollowers,
  }
}

const _onClickFollowers = function*(action: Constants.OnClickFollowers): SagaGenerator<any, any> {
  if (!action.payload.username) {
    return
  }

  if (!action.openWebsite) {
    // TODO(mm) hint followings
    yield put(showUserProfile(action.payload.username))
  } else {
    yield call(openURL, `${keybaseUrl}/${action.payload.username}#profile-tracking-section`)
  }
}

function onClickFollowing(username: string, openWebsite?: boolean): Constants.OnClickFollowing {
  return {
    payload: {
      openWebsite,
      username,
    },
    type: Constants.onClickFollowing,
  }
}

const _onClickFollowing = function*(action: Constants.OnClickFollowing): SagaGenerator<any, any> {
  if (!action.payload.username) {
    return
  }

  if (!action.openWebsite) {
    // TODO(mm) hint followings
    yield put(showUserProfile(action.payload.username))
  } else {
    yield call(openURL, `${keybaseUrl}/${action.payload.username}#profile-tracking-section`)
  }
}

function submitRevokeProof(proofId: string): Constants.SubmitRevokeProof {
  return {payload: {proofId}, type: Constants.submitRevokeProof}
}

const _submitRevokeProof = function*(action: Constants.SubmitRevokeProof): SagaGenerator<any, any> {
  try {
    yield put(_revokedWaitingForResponse(true))
    yield call(revokeRevokeSigsRpcPromise, {param: {sigIDQueries: [action.payload.proofId]}})
    yield put(_revokedWaitingForResponse(false))

    yield put(finishRevoking())
  } catch (error) {
    console.warn(`Error when revoking proof ${action.payload.proofId}`, error)
    yield put(_revokedWaitingForResponse(false))
    yield put(
      _revokedErrorResponse('There was an error revoking your proof. You can click the button to try again.')
    )
  }
}

function _openURLIfNotNull(nullableThing, url, metaText) {
  if (nullableThing == null) {
    console.warn("Can't openURL because we have a null", metaText)
    return
  }
  openURL(url)
}

function outputInstructionsActionLink(): Constants.OutputInstructionsActionLink {
  return {payload: undefined, type: Constants.outputInstructionsActionLink}
}

const _onAppLink = function*(action: AppLink): SagaGenerator<any, any> {
  const match = action.payload.link.match(/^https:\/\/keybase\.io\/(\w+)$/)
  const username = match && match[1]
  if (username) {
    yield put(showUserProfile(username))
  }
}

const _outputInstructionsActionLink = function*(): SagaGenerator<any, any> {
  const getProfile = (state: TypedState) => state.profile
  const profile: Constants.State = (yield select(getProfile): any)
  switch (profile.platform) {
    case 'twitter':
      yield call(
        _openURLIfNotNull,
        profile.proofText,
        `https://twitter.com/home?status=${profile.proofText || ''}`,
        'twitter url'
      )
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

function backToProfile(): Constants.BackToProfile {
  return {payload: undefined, type: Constants.backToProfile}
}

function clearSearchResults(): Constants.ClearSearchResults {
  return {payload: undefined, type: Constants.clearSearchResults}
}

const _backToProfile = function*(): SagaGenerator<any, any> {
  yield put(getMyProfile())
  yield put(navigateTo([], [profileTab]))
}

const _profileSaga = function*(): SagaGenerator<any, any> {
  yield safeTakeEvery(Constants.backToProfile, _backToProfile)
  yield safeTakeEvery(Constants.editProfile, _editProfile)
  yield safeTakeEvery(Constants.finishRevoking, _finishRevoking)
  yield safeTakeEvery(Constants.onClickAvatar, _onClickAvatar)
  yield safeTakeEvery(Constants.onClickFollowers, _onClickFollowers)
  yield safeTakeEvery(Constants.onClickFollowing, _onClickFollowing)
  yield safeTakeEvery(Constants.outputInstructionsActionLink, _outputInstructionsActionLink)
  yield safeTakeEvery(Constants.showUserProfile, _showUserProfile)
  yield safeTakeEvery(Constants.submitRevokeProof, _submitRevokeProof)
  yield safeTakeEvery('app:link', _onAppLink)
}

const profileSaga = function*(): SagaGenerator<any, any> {
  yield fork(_profileSaga)
  yield fork(pgpSaga)
  yield fork(proofsSaga)
}

export {
  addProof,
  backToProfile,
  cancelAddProof,
  checkProof,
  clearSearchResults,
  dropPgp,
  editProfile,
  finishRevoking,
  generatePgp,
  onClickAvatar,
  onClickFollowers,
  onClickFollowing,
  showUserProfile,
  outputInstructionsActionLink,
  submitBTCAddress,
  submitZcashAddress,
  submitRevokeProof,
  submitUsername,
  updatePgpInfo,
  updateUsername,
}

export default profileSaga
