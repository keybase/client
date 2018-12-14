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
import * as RouteTree from '../../actions/route-tree-gen'
import {peopleTab} from '../../constants/tabs'
import {pgpSaga} from './pgp'
import {proofsSaga} from './proofs'

import type {TypedState} from '../../constants/reducer'

function _editProfile(action: ProfileGen.EditProfilePayload) {
  const {bio, fullname, location} = action.payload
  return Saga.sequentially([
    Saga.callUntyped(RPCTypes.userProfileEditRpcPromise, {
      bio,
      fullName: fullname,
      location,
    }),
    // If the profile tab remained on the edit profile screen, navigate back to the top level.
    Saga.put(RouteTree.createNavigateUp()),
  ])
}

function _uploadAvatar(action: ProfileGen.UploadAvatarPayload) {
  const {filename, crop} = action.payload
  return Saga.sequentially([
    Saga.callUntyped(RPCTypes.userUploadUserAvatarRpcPromise, {
      crop,
      filename,
    }),
    Saga.put(RouteTree.createNavigateUp()),
  ])
}

function _finishRevoking() {
  return Saga.sequentially([
    Saga.put(TrackerGen.createGetMyProfile({ignoreCache: true})),
    Saga.put(ProfileGen.createRevokeFinish()),
    Saga.put(RouteTree.createNavigateUp()),
  ])
}

const showUserProfile = (state: TypedState, action: ProfileGen.ShowUserProfilePayload) => {
  const {username: userId} = action.payload
  // TODO search itself should handle this
  const username = SearchConstants.maybeUpgradeSearchResultIdToKeybaseId(
    state.entities.search.searchResults,
    userId
  )
  // Get the peopleTab path
  const peopleRouteProps = getPathProps(state.routeTree.routeState, [peopleTab])
  const path = Constants.getProfilePath(peopleRouteProps, username, state.config.username, state)
  // $FlowIssue
  return path ? Promise.resolve(RouteTree.createNavigateTo({path})) : null
}

const onClickAvatar = (_, action: ProfileGen.OnClickAvatarPayload) => {
  if (!action.payload.username) {
    return
  }

  if (!action.payload.openWebsite) {
    return Saga.put(ProfileGen.createShowUserProfile({username: action.payload.username}))
  } else {
    return Saga.callUntyped(openURL, `${keybaseUrl}/${action.payload.username}`)
  }
}

const openProfileOrWebsite = (
  _,
  action: ProfileGen.OnClickFollowersPayload | ProfileGen.OnClickFollowingPayload
) => {
  if (!action.payload.username) {
    return
  }

  if (!action.payload.openWebsite) {
    return Saga.put(ProfileGen.createShowUserProfile({username: action.payload.username}))
  } else {
    return Saga.callUntyped(openURL, `${keybaseUrl}/${action.payload.username}#profile-tracking-section`)
  }
}

function* _submitRevokeProof(action: ProfileGen.SubmitRevokeProofPayload): Saga.SagaGenerator<any, any> {
  try {
    yield* Saga.callPromise(
      RPCTypes.revokeRevokeSigsRpcPromise,
      {sigIDQueries: [action.payload.proofId]},
      Constants.waitingKey
    )
    yield Saga.put(ProfileGen.createFinishRevoking())
  } catch (error) {
    logger.warn(`Error when revoking proof ${action.payload.proofId}`, error)
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

const outputInstructionsActionLink = (
  state: TypedState,
  action: ProfileGen.OutputInstructionsActionLinkPayload
) => {
  const profile = state.profile
  switch (profile.platform) {
    case 'twitter':
      return Saga.callUntyped(
        _openURLIfNotNull,
        profile.proofText,
        `https://twitter.com/home?status=${profile.proofText || ''}`,
        'twitter url'
      )
    case 'github':
      return Saga.callUntyped(openURL, 'https://gist.github.com/')
    case 'reddit':
      return Saga.callUntyped(_openURLIfNotNull, profile.proofText, profile.proofText, 'reddit url')
    case 'facebook':
      return Saga.callUntyped(_openURLIfNotNull, profile.proofText, profile.proofText, 'facebook url')
    case 'hackernews':
      return Saga.callUntyped(openURL, `https://news.ycombinator.com/user?id=${profile.username}`)
    default:
      break
  }
}

function _backToProfile() {
  return Saga.sequentially([
    Saga.put(TrackerGen.createGetMyProfile({})),
    Saga.put(RouteTree.createNavigateTo({parentPath: [peopleTab], path: ['profile']})),
  ])
}

function* _profileSaga() {
  yield Saga.safeTakeEvery(ProfileGen.submitRevokeProof, _submitRevokeProof)
  yield Saga.safeTakeEveryPure(ProfileGen.backToProfile, _backToProfile)
  yield Saga.safeTakeEveryPure(ProfileGen.editProfile, _editProfile)
  yield Saga.safeTakeEveryPure(ProfileGen.uploadAvatar, _uploadAvatar)
  yield Saga.safeTakeEveryPure(ProfileGen.finishRevoking, _finishRevoking)
  yield Saga.actionToAction(ProfileGen.onClickAvatar, onClickAvatar)
  yield Saga.actionToAction([ProfileGen.onClickFollowers, ProfileGen.onClickFollowing], openProfileOrWebsite)
  yield Saga.actionToAction(ProfileGen.outputInstructionsActionLink, outputInstructionsActionLink)
  yield Saga.actionToPromise(ProfileGen.showUserProfile, showUserProfile)
}

function* profileSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.spawn(_profileSaga)
  yield Saga.spawn(pgpSaga)
  yield Saga.spawn(proofsSaga)
}

export default profileSaga
