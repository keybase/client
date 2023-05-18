import type * as Container from '../util/container'
import profile from './user/page'
import profileAddToTeam from './add-to-team/page'
import profileConfirmOrPending from './confirm-or-pending/page'
import profileEdit from './edit-profile/page'
import profileEditAvatar from './edit-avatar/page'
import profileGenericEnterUsername from './generic/enter-username/page'
import profileGenericProofResult from './generic/result/page'
import profilePostProof from './post-proof/page'
import profileProofsList from './generic/proofs-list/page'
import profileProveEnterUsername from './prove-enter-username/page'
import profileProveWebsiteChoice from './prove-website-choice/page'
import profileRevoke from './revoke/page'
import profileShowcaseTeamOffer from './showcase-team-offer/page'
import profileFinished from './pgp/finished/page'
import profileGenerate from './pgp/generate/page'
import profileImport from './pgp/import/page'
import profilePgp from './pgp/choice/page'
import profileProvideInfo from './pgp/info/page'

export const newRoutes = {
  profile,
}

export const newModalRoutes = {
  profileAddToTeam,
  profileConfirmOrPending,
  profileEdit,
  profileEditAvatar,
  profileFinished,
  profileGenerate,
  profileGenericEnterUsername,
  profileGenericProofResult,
  profileImport,
  profilePgp,
  profilePostProof,
  profileProofsList,
  profileProveEnterUsername,
  profileProveWebsiteChoice,
  profileProvideInfo,
  profileRevoke,
  profileShowcaseTeamOffer,
}

export type RootParamListProfile = Container.PagesToParams<typeof newRoutes & typeof newModalRoutes>
