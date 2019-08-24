import * as Constants from '../../constants/profile'
import * as ProfileGen from '../profile-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Saga from '../../util/saga'
import * as SearchConstants from '../../constants/search'
import * as TrackerConstants from '../../constants/tracker2'
import * as Tracker2Gen from '../tracker2-gen'
import logger from '../../logger'
import openURL from '../../util/open-url'
import {RPCError} from '../../util/errors'
import {pgpSaga} from './pgp'
import {proofsSaga} from './proofs'
import {TypedState, isMobile} from '../../util/container'

const editProfile = (state: TypedState, action: ProfileGen.EditProfilePayload) =>
  RPCTypes.userProfileEditRpcPromise(
    {
      bio: action.payload.bio,
      fullName: action.payload.fullname,
      location: action.payload.location,
    },
    TrackerConstants.waitingKey
  ).then(() => Tracker2Gen.createShowUser({asTracker: false, username: state.config.username}))

const uploadAvatar = (_: TypedState, action: ProfileGen.UploadAvatarPayload) =>
  RPCTypes.userUploadUserAvatarRpcPromise(
    {
      crop: action.payload.crop,
      filename: action.payload.filename,
    },
    Constants.uploadAvatarWaitingKey
  )
    .then(() => RouteTreeGen.createNavigateUp())
    .catch(e => {
      // error displayed in component
      logger.warn(`Error uploading user avatar: ${e.message}`)
    })

const finishRevoking = (state: TypedState) => [
  Tracker2Gen.createShowUser({asTracker: false, username: state.config.username}),
  Tracker2Gen.createLoad({
    assertion: state.config.username,
    guiID: TrackerConstants.generateGUIID(),
    inTracker: false,
    reason: '',
  }),
  ProfileGen.createRevokeFinish(),
]

const showUserProfile = (state: TypedState, action: ProfileGen.ShowUserProfilePayload) => {
  const {username: userId} = action.payload
  // TODO search itself should handle this
  const username = SearchConstants.maybeUpgradeSearchResultIdToKeybaseId(
    state.entities.search.searchResults,
    userId
  )

  return [
    RouteTreeGen.createClearModals(),
    RouteTreeGen.createNavigateAppend({path: [{props: {username}, selected: 'profile'}]}),
  ]
}

const onClickAvatar = (_: TypedState, action: ProfileGen.OnClickAvatarPayload) => {
  if (!action.payload.username) {
    return
  }

  if (!action.payload.openWebsite) {
    return ProfileGen.createShowUserProfile({username: action.payload.username})
  } else {
    openURL(`https://keybase.io/${action.payload.username}`)
    return undefined
  }
}

const submitRevokeProof = (state: TypedState, action: ProfileGen.SubmitRevokeProofPayload) => {
  const you = TrackerConstants.getDetails(state, state.config.username)
  if (!you || !you.assertions) return null
  const proof = you.assertions.find(a => a.sigID === action.payload.proofId)
  if (!proof) return null

  if (proof.type === 'pgp') {
    return RPCTypes.revokeRevokeKeyRpcPromise({keyID: proof.kid}, Constants.waitingKey).catch(e => {
      logger.info('error in dropping pgp key', e)
      return ProfileGen.createRevokeFinishError({error: `Error in dropping Pgp Key: ${e}`})
    })
  } else {
    return RPCTypes.revokeRevokeSigsRpcPromise({sigIDQueries: [action.payload.proofId]}, Constants.waitingKey)
      .then(() => ProfileGen.createFinishRevoking())
      .catch((error: RPCError) => {
        logger.warn(`Error when revoking proof ${action.payload.proofId}`, error)
        return ProfileGen.createRevokeFinishError({
          error: 'There was an error revoking your proof. You can click the button to try again.',
        })
      })
  }
}

const submitBlockUser = (_: TypedState, action: ProfileGen.SubmitBlockUserPayload) => {
  return RPCTypes.userBlockUserRpcPromise({username: action.payload.username}, Constants.blockUserWaitingKey)
    .then(() => [
      ProfileGen.createFinishBlockUser(),
      Tracker2Gen.createLoad({
        assertion: action.payload.username,
        guiID: TrackerConstants.generateGUIID(),
        inTracker: false,
        reason: '',
      }),
    ])
    .catch((error: RPCError) => {
      logger.warn(`Error blocking user ${action.payload.username}`, error)
      return ProfileGen.createFinishBlockUserError({
        error: error.desc || `There was an error blocking ${action.payload.username}.`,
      })
    })
}

const submitUnblockUser = (_: TypedState, action: ProfileGen.SubmitUnblockUserPayload) => {
  return RPCTypes.userUnblockUserRpcPromise(
    {username: action.payload.username},
    Constants.blockUserWaitingKey
  )
    .then(() =>
      Tracker2Gen.createLoad({
        assertion: action.payload.username,
        guiID: TrackerConstants.generateGUIID(),
        inTracker: false,
        reason: '',
      })
    )
    .catch((error: RPCError) => {
      logger.warn(`Error unblocking user ${action.payload.username}`, error)
      return Tracker2Gen.createUpdateResult({
        guiID: action.payload.guiID,
        reason: `Failed to unblock ${action.payload.username}: ${error.desc}`,
        result: 'error',
      })
    })
}

const editAvatar = () =>
  isMobile
    ? undefined // handled in platform specific
    : RouteTreeGen.createNavigateAppend({path: [{props: {image: null}, selected: 'profileEditAvatar'}]})

const backToProfile = (state: TypedState) => [
  Tracker2Gen.createShowUser({asTracker: false, username: state.config.username}),
  RouteTreeGen.createNavigateAppend({path: ['profile']}),
]

function* _profileSaga() {
  yield* Saga.chainAction2(ProfileGen.submitRevokeProof, submitRevokeProof)
  yield* Saga.chainAction2(ProfileGen.submitBlockUser, submitBlockUser)
  yield* Saga.chainAction2(ProfileGen.submitUnblockUser, submitUnblockUser)
  yield* Saga.chainAction2(ProfileGen.backToProfile, backToProfile)
  yield* Saga.chainAction2(ProfileGen.editProfile, editProfile)
  yield* Saga.chainAction2(ProfileGen.uploadAvatar, uploadAvatar)
  yield* Saga.chainAction2(ProfileGen.finishRevoking, finishRevoking)
  yield* Saga.chainAction2(ProfileGen.onClickAvatar, onClickAvatar)
  yield* Saga.chainAction2(ProfileGen.showUserProfile, showUserProfile)
  yield* Saga.chainAction2(ProfileGen.editAvatar, editAvatar)
}

function* profileSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.spawn(_profileSaga)
  yield Saga.spawn(pgpSaga)
  yield Saga.spawn(proofsSaga)
}

export default profileSaga
