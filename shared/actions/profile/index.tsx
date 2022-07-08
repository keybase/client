import * as Container from '../../util/container'
import * as Constants from '../../constants/profile'
import * as ProfileGen from '../profile-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as RouteTreeGen from '../route-tree-gen'
import * as TrackerConstants from '../../constants/tracker2'
import * as Tracker2Gen from '../tracker2-gen'
import logger from '../../logger'
import openURL from '../../util/open-url'
import {RPCError} from '../../util/errors'
import {initPgp} from './pgp'
import {initProofs} from './proofs'

const editProfile = async (state: Container.TypedState, action: ProfileGen.EditProfilePayload) => {
  await RPCTypes.userProfileEditRpcPromise(
    {
      bio: action.payload.bio,
      fullName: action.payload.fullname,
      location: action.payload.location,
    },
    TrackerConstants.waitingKey
  )
  return Tracker2Gen.createShowUser({asTracker: false, username: state.config.username})
}

const uploadAvatar = async (_: unknown, action: ProfileGen.UploadAvatarPayload) => {
  try {
    await RPCTypes.userUploadUserAvatarRpcPromise(
      {
        crop: action.payload.crop,
        filename: action.payload.filename,
      },
      Constants.uploadAvatarWaitingKey
    )
    return RouteTreeGen.createNavigateUp()
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    // error displayed in component
    logger.warn(`Error uploading user avatar: ${error.message}`)
    return false
  }
}

const finishRevoking = (state: Container.TypedState) => [
  Tracker2Gen.createShowUser({asTracker: false, username: state.config.username}),
  Tracker2Gen.createLoad({
    assertion: state.config.username,
    guiID: TrackerConstants.generateGUIID(),
    inTracker: false,
    reason: '',
  }),
  ProfileGen.createRevokeFinish(),
]

const showUserProfile = (_: unknown, action: ProfileGen.ShowUserProfilePayload) => {
  const {username} = action.payload
  return [
    ...(Container.isMobile ? [RouteTreeGen.createClearModals()] : []),
    RouteTreeGen.createNavigateAppend({path: [{props: {username}, selected: 'profile'}]}),
  ]
}

const onClickAvatar = (_: unknown, action: ProfileGen.OnClickAvatarPayload) => {
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

const submitRevokeProof = async (
  state: Container.TypedState,
  action: ProfileGen.SubmitRevokeProofPayload
) => {
  const you = TrackerConstants.getDetails(state, state.config.username)
  if (!you || !you.assertions) return null
  const proof = [...you.assertions.values()].find(a => a.sigID === action.payload.proofId)
  if (!proof) return null

  if (proof.type === 'pgp') {
    try {
      await RPCTypes.revokeRevokeKeyRpcPromise({keyID: proof.kid}, Constants.waitingKey)
      return false
    } catch (e) {
      logger.info('error in dropping pgp key', e)
      return ProfileGen.createRevokeFinish({error: `Error in dropping Pgp Key: ${e}`})
    }
  } else {
    try {
      await RPCTypes.revokeRevokeSigsRpcPromise(
        {sigIDQueries: [action.payload.proofId]},
        Constants.waitingKey
      )
      return ProfileGen.createFinishRevoking()
    } catch (error) {
      logger.warn(`Error when revoking proof ${action.payload.proofId}`, error)
      return ProfileGen.createRevokeFinish({
        error: 'There was an error revoking your proof. You can click the button to try again.',
      })
    }
  }
}

const submitBlockUser = async (_: unknown, action: ProfileGen.SubmitBlockUserPayload) => {
  try {
    await RPCTypes.userBlockUserRpcPromise({username: action.payload.username}, Constants.blockUserWaitingKey)
    return [
      ProfileGen.createFinishBlockUser(),
      Tracker2Gen.createLoad({
        assertion: action.payload.username,
        guiID: TrackerConstants.generateGUIID(),
        inTracker: false,
        reason: '',
      }),
    ]
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    logger.warn(`Error blocking user ${action.payload.username}`, error)
    return ProfileGen.createFinishBlockUser({
      error: error.desc || `There was an error blocking ${action.payload.username}.`,
    })
  }
}

const submitUnblockUser = async (_: unknown, action: ProfileGen.SubmitUnblockUserPayload) => {
  try {
    await RPCTypes.userUnblockUserRpcPromise(
      {username: action.payload.username},
      Constants.blockUserWaitingKey
    )
    return Tracker2Gen.createLoad({
      assertion: action.payload.username,
      guiID: TrackerConstants.generateGUIID(),
      inTracker: false,
      reason: '',
    })
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    logger.warn(`Error unblocking user ${action.payload.username}`, error)
    return Tracker2Gen.createUpdateResult({
      guiID: action.payload.guiID,
      reason: `Failed to unblock ${action.payload.username}: ${error.desc}`,
      result: 'error',
    })
  }
}

const hideStellar = async (_: Container.TypedState, action: ProfileGen.HideStellarPayload) => {
  try {
    await RPCTypes.apiserverPostRpcPromise(
      {
        args: [{key: 'hidden', value: action.payload.hidden ? '1' : '0'}],
        endpoint: 'stellar/hidden',
      },
      TrackerConstants.waitingKey
    )
  } catch (e) {
    logger.warn('Error setting Stellar hidden:', e)
  }
}
const editAvatar = () =>
  Container.isMobile
    ? undefined // handled in platform specific
    : RouteTreeGen.createNavigateAppend({path: [{props: {image: undefined}, selected: 'profileEditAvatar'}]})

const backToProfile = (state: Container.TypedState) => [
  RouteTreeGen.createClearModals(),
  Tracker2Gen.createShowUser({asTracker: false, username: state.config.username}),
]

const wotVouch = async (state: Container.TypedState, action: ProfileGen.WotVouchPayload) => {
  const {guiID, otherText, proofs, statement, username, verificationType} = action.payload
  const details = state.tracker2.usernameToDetails.get(username)
  if (!details) {
    return ProfileGen.createWotVouchSetError({error: 'Missing user details.'})
  } else if (details.state !== 'valid') {
    return ProfileGen.createWotVouchSetError({error: `User is not in a valid state. (${details.state})`})
  } else if (details.resetBrokeTrack) {
    return ProfileGen.createWotVouchSetError({error: 'User has reset their account since following.'})
  }
  try {
    await RPCTypes.wotWotVouchRpcPromise(
      {
        confidence: {
          other: otherText,
          proofs,
          usernameVerifiedVia: verificationType,
        },
        guiID,
        username,
        vouchText: statement,
      },
      Constants.wotAuthorWaitingKey
    )
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    logger.warn('Error from wotVouch:', error)
    return ProfileGen.createWotVouchSetError({
      error: error.desc || `There was an error submitting the claim.`,
    })
  }
  return [ProfileGen.createWotVouchSetError({error: ''}), RouteTreeGen.createClearModals()]
}

const initProfile = () => {
  Container.listenAction(ProfileGen.submitRevokeProof, submitRevokeProof)
  Container.listenAction(ProfileGen.submitBlockUser, submitBlockUser)
  Container.listenAction(ProfileGen.submitUnblockUser, submitUnblockUser)
  Container.listenAction(ProfileGen.backToProfile, backToProfile)
  Container.listenAction(ProfileGen.editProfile, editProfile)
  Container.listenAction(ProfileGen.uploadAvatar, uploadAvatar)
  Container.listenAction(ProfileGen.finishRevoking, finishRevoking)
  Container.listenAction(ProfileGen.onClickAvatar, onClickAvatar)
  Container.listenAction(ProfileGen.showUserProfile, showUserProfile)
  Container.listenAction(ProfileGen.editAvatar, editAvatar)
  Container.listenAction(ProfileGen.hideStellar, hideStellar)
  Container.listenAction(ProfileGen.wotVouch, wotVouch)
  initPgp()
  initProofs()
}

export default initProfile
