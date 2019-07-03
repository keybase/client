import * as Constants from '../../constants/profile'
import * as ProfileGen from '../profile-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Saga from '../../util/saga'
import * as SearchConstants from '../../constants/search'
import * as TrackerConstants from '../../constants/tracker2'
import * as Tracker2Gen from '../tracker2-gen'
import keybaseUrl from '../../constants/urls'
import logger from '../../logger'
import openURL from '../../util/open-url'
import {RPCError} from '../../util/errors'
import {peopleTab} from '../../constants/tabs'
import {pgpSaga} from './pgp'
import {proofsSaga} from './proofs'
import {isMobile} from '../../constants/platform'

const editProfile = (state, action: ProfileGen.EditProfilePayload) =>
  RPCTypes.userProfileEditRpcPromise(
    {
      bio: action.payload.bio,
      fullName: action.payload.fullname,
      location: action.payload.location,
    },
    TrackerConstants.waitingKey
  ).then(() => Tracker2Gen.createShowUser({asTracker: false, username: state.config.username}))

const uploadAvatar = (_, action: ProfileGen.UploadAvatarPayload) =>
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

const finishRevoking = state => [
  Tracker2Gen.createShowUser({asTracker: false, username: state.config.username}),
  Tracker2Gen.createLoad({
    assertion: state.config.username,
    guiID: TrackerConstants.generateGUIID(),
    inTracker: false,
    reason: '',
  }),
  ProfileGen.createRevokeFinish(),
]

const showUserProfile = (state, action: ProfileGen.ShowUserProfilePayload) => {
  const {username: userId} = action.payload
  // TODO search itself should handle this
  const username = SearchConstants.maybeUpgradeSearchResultIdToKeybaseId(
    state.entities.search.searchResults,
    userId
  )

  return [
    RouteTreeGen.createClearModals(),
    RouteTreeGen.createNavigateTo({path: [{props: {username}, selected: 'profile'}]}),
  ]
}

const onClickAvatar = (_, action: ProfileGen.OnClickAvatarPayload) => {
  if (!action.payload.username) {
    return
  }

  if (!action.payload.openWebsite) {
    return ProfileGen.createShowUserProfile({username: action.payload.username})
  } else {
    openURL(`${keybaseUrl}/${action.payload.username}`)
  }
}

const submitRevokeProof = (state, action: ProfileGen.SubmitRevokeProofPayload) => {
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

const submitBlockUser = (state, action: ProfileGen.SubmitBlockUserPayload) => {
  return RPCTypes.userBlockUserRpcPromise({username: action.payload.username}, Constants.blockUserWaitingKey)
    .then(() => [
      ProfileGen.createFinishBlockUser(),
      Tracker2Gen.createLoad({
        assertion: action.payload.username,
        guiID: TrackerConstants.generateGUIID(),
        inTracker: false,
        reason: '',
    })])
    .catch((error: RPCError) => {
      logger.warn(`Error blocking user ${action.payload.username}`, error)
      return ProfileGen.createFinishBlockUserError({
        error: error.desc || `There was an error blocking ${action.payload.username}.`,
      })
    })
}

const submitUnblockUser = (state, action: ProfileGen.SubmitUnblockUserPayload) => {
  return RPCTypes.userUnblockUserRpcPromise({username: action.payload.username}, Constants.blockUserWaitingKey)
    .then(() => Tracker2Gen.createLoad({
      assertion: action.payload.username,
      guiID: TrackerConstants.generateGUIID(),
      inTracker: false,
      reason: '',
    }))
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

const backToProfile = state => [
  Tracker2Gen.createShowUser({asTracker: false, username: state.config.username}),
  RouteTreeGen.createNavigateTo({parentPath: [peopleTab], path: ['profile']}),
]

function* _profileSaga() {
  yield* Saga.chainAction<ProfileGen.SubmitRevokeProofPayload>(
    ProfileGen.submitRevokeProof,
    submitRevokeProof
  )
  yield* Saga.chainAction<ProfileGen.SubmitBlockUserPayload>(ProfileGen.submitBlockUser, submitBlockUser)
  yield* Saga.chainAction<ProfileGen.SubmitUnblockUserPayload>(ProfileGen.submitUnblockUser, submitUnblockUser)
  yield* Saga.chainAction<ProfileGen.BackToProfilePayload>(ProfileGen.backToProfile, backToProfile)
  yield* Saga.chainAction<ProfileGen.EditProfilePayload>(ProfileGen.editProfile, editProfile)
  yield* Saga.chainAction<ProfileGen.UploadAvatarPayload>(ProfileGen.uploadAvatar, uploadAvatar)
  yield* Saga.chainAction<ProfileGen.FinishRevokingPayload>(ProfileGen.finishRevoking, finishRevoking)
  yield* Saga.chainAction<ProfileGen.OnClickAvatarPayload>(ProfileGen.onClickAvatar, onClickAvatar)
  yield* Saga.chainAction<ProfileGen.ShowUserProfilePayload>(ProfileGen.showUserProfile, showUserProfile)
  yield* Saga.chainAction<ProfileGen.EditAvatarPayload>(ProfileGen.editAvatar, editAvatar)
}

function* profileSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.spawn(_profileSaga)
  yield Saga.spawn(pgpSaga)
  yield Saga.spawn(proofsSaga)
}

export default profileSaga
