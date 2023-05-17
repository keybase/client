import {newRoutes as PGPRoutes} from './pgp/routes-sub'
import profile, {type RouteProps as ProfileProps} from './user/page'
import profileAddToTeam, {type RouteProps as ProfileAddToTeamProps} from './add-to-team/page'
import profileConfirmOrPending from './confirm-or-pending/page'
import profileEdit from './edit-profile/page'
import profileEditAvatar, {type RouteProps as ProfileEditAvatarProps} from './edit-avatar/page'
import profileGenericEnterUsername from './generic/enter-username/page'
import profileGenericProofResult from './generic/result/page'
import profilePostProof from './post-proof/page'
import profileProofsList from './generic/proofs-list/page'
import profileProveEnterUsername from './prove-enter-username/page'
import profileProveWebsiteChoice from './prove-website-choice/page'
import profileRevoke, {type RouteProps as ProfileRevokeProps} from './revoke/page'
import profileShowcaseTeamOffer from './showcase-team-offer/page'

export const newRoutes = {
  ...profile,
}

export const newModalRoutes = {
  ...profileAddToTeam,
  ...profileConfirmOrPending,
  ...profileEdit,
  ...profileEditAvatar,
  ...profileGenericEnterUsername,
  ...profileGenericProofResult,
  ...profilePostProof,
  ...profileProofsList,
  ...profileProveEnterUsername,
  ...profileProveWebsiteChoice,
  ...profileRevoke,
  ...profileShowcaseTeamOffer,
  ...PGPRoutes,
}

type NoParams = {
  profileConfirmOrPending: undefined
  profileEdit: undefined
  profileGenericEnterUsername: undefined
  profileGenericProofResult: undefined
  profilePostProof: undefined
  profileProofsList: undefined
  profileProveEnterUsername: undefined
  profileProveWebsiteChoice: undefined
  profileShowcaseTeamOffer: undefined
  profileFinished: undefined
  profileGenerate: undefined
  profileImport: undefined
  profilePgp: undefined
  profileProvideInfo: undefined
}

export type RootParamListProfile = NoParams &
  ProfileEditAvatarProps &
  ProfileProps &
  ProfileAddToTeamProps &
  ProfileRevokeProps
