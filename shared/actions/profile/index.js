// @flow
import * as Constants from '../../constants/profile'
import * as ProfileGen from '../profile-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Saga from '../../util/saga'
import * as SearchConstants from '../../constants/search'
import * as TrackerConstants from '../../constants/tracker2'
import * as TrackerGen from '../tracker-gen'
import * as Tracker2Gen from '../tracker2-gen'
import keybaseUrl from '../../constants/urls'
import logger from '../../logger'
import openURL from '../../util/open-url'
import {getPathProps} from '../../route-tree'
import type {RPCError} from '../../util/errors'
import {peopleTab} from '../../constants/tabs'
import {pgpSaga} from './pgp'
import {proofsSaga} from './proofs'
import flags from '../../util/feature-flags'
import {isMobile} from '../../constants/platform'

const editProfile = (state, action) =>
  RPCTypes.userProfileEditRpcPromise(
    {
      bio: action.payload.bio,
      fullName: action.payload.fullname,
      location: action.payload.location,
    },
    TrackerConstants.waitingKey
  ).then(() => {
    if (flags.identify3) {
      return Tracker2Gen.createLoad({
        assertion: state.config.username,
        guiID: TrackerConstants.generateGUIID(),
        ignoreCache: true,
        inTracker: false,
        reason: '',
      })
    } else {
      return RouteTreeGen.createNavigateUp()
    }
  })

const uploadAvatar = (_, action) =>
  RPCTypes.userUploadUserAvatarRpcPromise({
    crop: action.payload.crop,
    filename: action.payload.filename,
  }).then(() => RouteTreeGen.createNavigateUp())

const finishRevoking = () => [
  TrackerGen.createGetMyProfile({ignoreCache: true}),
  ProfileGen.createRevokeFinish(),
  RouteTreeGen.createNavigateUp(),
]

const showUserProfile = (state, action) => {
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
  return path && RouteTreeGen.createNavigateTo({path})
}

const onClickAvatar = (_, action) => {
  if (!action.payload.username) {
    return
  }

  if (!action.payload.openWebsite) {
    return ProfileGen.createShowUserProfile({username: action.payload.username})
  } else {
    openURL(`${keybaseUrl}/${action.payload.username}`)
  }
}

const submitRevokeProof = (_, action) =>
  RPCTypes.revokeRevokeSigsRpcPromise({sigIDQueries: [action.payload.proofId]}, Constants.waitingKey)
    .then(() => ProfileGen.createFinishRevoking())
    .catch((error: RPCError) => {
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

const outputInstructionsActionLink = (state, action) => {
  const profile = state.profile
  switch (profile.platform) {
    case 'twitter':
      openURLIfNotNull(
        profile.proofText,
        `https://twitter.com/home?status=${profile.proofText || ''}`,
        'twitter url'
      )
      break
    case 'github':
      openURL('https://gist.github.com/')
      break
    case 'reddit':
      openURLIfNotNull(profile.proofText, profile.proofText, 'reddit url')
      break
    case 'facebook':
      openURLIfNotNull(profile.proofText, profile.proofText, 'facebook url')
      break
    case 'hackernews':
      openURL(`https://news.ycombinator.com/user?id=${profile.username}`)
      break
    default:
      break
  }
}

const editAvatar = () =>
  isMobile
    ? undefined // handled in platform specific
    : RouteTreeGen.createNavigateAppend({path: [{props: {image: null}, selected: 'editAvatar'}]})

const backToProfile = () => [
  TrackerGen.createGetMyProfile({}),
  RouteTreeGen.createNavigateTo({parentPath: [peopleTab], path: ['profile']}),
]

function* _profileSaga() {
  yield* Saga.chainAction<ProfileGen.SubmitRevokeProofPayload>(
    ProfileGen.submitRevokeProof,
    submitRevokeProof
  )
  yield* Saga.chainAction<ProfileGen.BackToProfilePayload>(ProfileGen.backToProfile, backToProfile)
  yield* Saga.chainAction<ProfileGen.EditProfilePayload>(ProfileGen.editProfile, editProfile)
  yield* Saga.chainAction<ProfileGen.UploadAvatarPayload>(ProfileGen.uploadAvatar, uploadAvatar)
  yield* Saga.chainAction<ProfileGen.FinishRevokingPayload>(ProfileGen.finishRevoking, finishRevoking)
  yield* Saga.chainAction<ProfileGen.OnClickAvatarPayload>(ProfileGen.onClickAvatar, onClickAvatar)
  yield* Saga.chainAction<ProfileGen.OutputInstructionsActionLinkPayload>(
    ProfileGen.outputInstructionsActionLink,
    outputInstructionsActionLink
  )
  yield* Saga.chainAction<ProfileGen.ShowUserProfilePayload>(ProfileGen.showUserProfile, showUserProfile)
  yield* Saga.chainAction<ProfileGen.EditAvatarPayload>(ProfileGen.editAvatar, editAvatar)
}

function* profileSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.spawn(_profileSaga)
  yield Saga.spawn(pgpSaga)
  yield Saga.spawn(proofsSaga)
}

export default profileSaga
