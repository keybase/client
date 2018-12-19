// @flow
import * as Constants from '../../constants/profile'
import * as ProfileGen from '../profile-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as RouteTree from '../../actions/route-tree-gen'
import * as Saga from '../../util/saga'
import * as SearchConstants from '../../constants/search'
import * as TrackerGen from '../tracker-gen'
import keybaseUrl from '../../constants/urls'
import logger from '../../logger'
import openURL from '../../util/open-url'
import type {TypedState} from '../../constants/reducer'
import {getPathProps} from '../../route-tree'
import {peopleTab} from '../../constants/tabs'
import {pgpSaga} from './pgp'
import {proofsSaga} from './proofs'

const editProfile = (_, action: ProfileGen.EditProfilePayload) =>
  RPCTypes.userProfileEditRpcPromise({
    bio: action.payload.bio,
    fullName: action.payload.fullname,
    location: action.payload.location,
  }).then(() => RouteTree.createNavigateUp())

const uploadAvatar = (_, action: ProfileGen.UploadAvatarPayload) =>
  RPCTypes.userUploadUserAvatarRpcPromise({
    crop: action.payload.crop,
    filename: action.payload.filename,
  }).then(() => RouteTree.createNavigateUp())

const finishRevoking = () =>
  Saga.sequentially([
    Saga.put(TrackerGen.createGetMyProfile({ignoreCache: true})),
    Saga.put(ProfileGen.createRevokeFinish()),
    Saga.put(RouteTree.createNavigateUp()),
  ])

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

const submitRevokeProof = (_, action: ProfileGen.SubmitRevokeProofPayload) =>
  RPCTypes.revokeRevokeSigsRpcPromise({sigIDQueries: [action.payload.proofId]}, Constants.waitingKey)
    .then(() => ProfileGen.createFinishRevoking())
    .catch(error => {
      logger.warn(`Error when revoking proof ${action.payload.proofId}`, error)
      return ProfileGen.createRevokeFinishError({
        error: 'There was an error revoking your proof. You can click the button to try again.',
      })
    })

const openURLIfNotNull = (nullableThing, url, metaText) => {
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
        openURLIfNotNull,
        profile.proofText,
        `https://twitter.com/home?status=${profile.proofText || ''}`,
        'twitter url'
      )
    case 'github':
      return Saga.callUntyped(openURL, 'https://gist.github.com/')
    case 'reddit':
      return Saga.callUntyped(openURLIfNotNull, profile.proofText, profile.proofText, 'reddit url')
    case 'facebook':
      return Saga.callUntyped(openURLIfNotNull, profile.proofText, profile.proofText, 'facebook url')
    case 'hackernews':
      return Saga.callUntyped(openURL, `https://news.ycombinator.com/user?id=${profile.username}`)
    default:
      break
  }
}

const backToProfile = () =>
  Saga.sequentially([
    Saga.put(TrackerGen.createGetMyProfile({})),
    Saga.put(RouteTree.createNavigateTo({parentPath: [peopleTab], path: ['profile']})),
  ])

function* _profileSaga() {
  yield Saga.actionToPromise(ProfileGen.submitRevokeProof, submitRevokeProof)
  yield Saga.actionToAction(ProfileGen.backToProfile, backToProfile)
  yield Saga.actionToPromise(ProfileGen.editProfile, editProfile)
  yield Saga.actionToPromise(ProfileGen.uploadAvatar, uploadAvatar)
  yield Saga.actionToAction(ProfileGen.finishRevoking, finishRevoking)
  yield Saga.actionToAction(ProfileGen.onClickAvatar, onClickAvatar)
  yield Saga.actionToAction(ProfileGen.outputInstructionsActionLink, outputInstructionsActionLink)
  yield Saga.actionToPromise(ProfileGen.showUserProfile, showUserProfile)
}

function* profileSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.spawn(_profileSaga)
  yield Saga.spawn(pgpSaga)
  yield Saga.spawn(proofsSaga)
}

export default profileSaga
