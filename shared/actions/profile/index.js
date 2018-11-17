// @flow
import logger from '../../logger'
import * as Constants from '../../constants/profile'
import * as TrackerGen from '../tracker-gen'
import * as ProfileGen from '../profile-gen'
import * as Saga from '../../util/saga'
import * as SearchConstants from '../../constants/search'
import * as RPCTypes from '../../constants/types/rpc-gen'
import keybaseUrl from '../../constants/urls'
import openURL from '../../util/open-url'
import {getPathProps} from '../../route-tree'
import {navigateTo, navigateUp} from '../../actions/route-tree'
import {peopleTab} from '../../constants/tabs'
import {pgpSaga} from './pgp'
import {proofsSaga} from './proofs'

import type {TypedState} from '../../constants/reducer'

function _editProfile(action: ProfileGen.EditProfilePayload) {
  const {bio, fullname, location} = action.payload
  return Saga.sequentially([
    Saga.call(RPCTypes.userProfileEditRpcPromise, {
      bio,
      fullName: fullname,
      location,
    }),
    // If the profile tab remained on the edit profile screen, navigate back to the top level.
    Saga.put(navigateUp()),
  ])
}

function _uploadAvatar(action: ProfileGen.UploadAvatarPayload) {
  const {filename, crop} = action.payload
  return Saga.sequentially([
    Saga.call(RPCTypes.userUploadUserAvatarRpcPromise, {
      crop,
      filename,
    }),
    Saga.put(navigateUp()),
  ])
}

function _finishRevoking() {
  return Saga.sequentially([
    Saga.put(TrackerGen.createGetMyProfile({ignoreCache: true})),
    Saga.put(ProfileGen.createRevokeFinish()),
    Saga.put(navigateUp()),
  ])
}

function _showUserProfile(action: ProfileGen.ShowUserProfilePayload, state: TypedState) {
  const {username: userId} = action.payload
  const username = SearchConstants.maybeUpgradeSearchResultIdToKeybaseId(
    state.entities.search.searchResults,
    userId
  )
  const me = state.config.username || ''
  // Get the peopleTab path
  const peopleRouteProps = getPathProps(state.routeTree.routeState, [peopleTab])
  const onlyProfilesPath = Constants.getProfilePath(peopleRouteProps, username, me, state)
  // $FlowIssue
  return Saga.put(navigateTo(onlyProfilesPath))
}

function _onClickAvatar(action: ProfileGen.OnClickAvatarPayload) {
  if (!action.payload.username) {
    return
  }

  if (!action.payload.openWebsite) {
    return Saga.put(ProfileGen.createShowUserProfile({username: action.payload.username}))
  } else {
    return Saga.call(openURL, `${keybaseUrl}/${action.payload.username}`)
  }
}

function _openProfileOrWebsite(
  action: ProfileGen.OnClickFollowersPayload | ProfileGen.OnClickFollowingPayload
) {
  if (!action.payload.username) {
    return
  }

  if (!action.payload.openWebsite) {
    return Saga.put(ProfileGen.createShowUserProfile({username: action.payload.username}))
  } else {
    return Saga.call(openURL, `${keybaseUrl}/${action.payload.username}#profile-tracking-section`)
  }
}

function* _submitRevokeProof(action: ProfileGen.SubmitRevokeProofPayload): Saga.SagaGenerator<any, any> {
  try {
    yield Saga.put(ProfileGen.createRevokeWaiting({waiting: true}))
    yield Saga.call(RPCTypes.revokeRevokeSigsRpcPromise, {sigIDQueries: [action.payload.proofId]})
    yield Saga.put(ProfileGen.createRevokeWaiting({waiting: false}))
    yield Saga.put(ProfileGen.createFinishRevoking())
  } catch (error) {
    logger.warn(`Error when revoking proof ${action.payload.proofId}`, error)
    yield Saga.put(ProfileGen.createRevokeWaiting({waiting: false}))
    yield Saga.put(
      ProfileGen.createRevokeFinishError({
        error: 'There was an error revoking your proof. You can click the button to try again.',
      })
    )
  }
}

function _openURLIfNotNull(nullableThing, url, metaText): void {
  if (nullableThing == null) {
    logger.warn("Can't open URL because we have a null", metaText)
    return
  }
  openURL(url)
}

function _outputInstructionsActionLink(
  action: ProfileGen.OutputInstructionsActionLinkPayload,
  state: TypedState
) {
  const profile = state.profile
  switch (profile.platform) {
    case 'twitter':
      return Saga.call(
        _openURLIfNotNull,
        profile.proofText,
        `https://twitter.com/home?status=${profile.proofText || ''}`,
        'twitter url'
      )
    case 'github':
      return Saga.call(openURL, 'https://gist.github.com/')
    case 'reddit':
      return Saga.call(_openURLIfNotNull, profile.proofText, profile.proofText, 'reddit url')
    case 'facebook':
      return Saga.call(_openURLIfNotNull, profile.proofText, profile.proofText, 'facebook url')
    case 'hackernews':
      return Saga.call(openURL, `https://news.ycombinator.com/user?id=${profile.username}`)
    default:
      break
  }
}

function _backToProfile() {
  return Saga.sequentially([
    Saga.put(TrackerGen.createGetMyProfile({})),
    Saga.put(navigateTo(['profile'], [peopleTab])),
  ])
}

function* _profileSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEvery(ProfileGen.submitRevokeProof, _submitRevokeProof)
  yield Saga.safeTakeEveryPure(ProfileGen.backToProfile, _backToProfile)
  yield Saga.safeTakeEveryPure(ProfileGen.editProfile, _editProfile)
  yield Saga.safeTakeEveryPure(ProfileGen.uploadAvatar, _uploadAvatar)
  yield Saga.safeTakeEveryPure(ProfileGen.finishRevoking, _finishRevoking)
  yield Saga.safeTakeEveryPure(ProfileGen.onClickAvatar, _onClickAvatar)
  yield Saga.safeTakeEveryPure(
    [ProfileGen.onClickFollowers, ProfileGen.onClickFollowing],
    _openProfileOrWebsite
  )
  yield Saga.safeTakeEveryPure(ProfileGen.outputInstructionsActionLink, _outputInstructionsActionLink)
  yield Saga.safeTakeEveryPure(ProfileGen.showUserProfile, _showUserProfile)
}

function* profileSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.spawn(_profileSaga)
  yield Saga.spawn(pgpSaga)
  yield Saga.spawn(proofsSaga)
}

export default profileSaga
