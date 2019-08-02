import {newRoutes as PGPRoutes} from './pgp/routes'
import Profile from './user/container'
import ProfileNonUser from './non-user-profile/container'
import ProfileAddToTeam from './add-to-team/container'
import ProfileBlockUser from './block/container'
import ProfileConfirmOrPending from './confirm-or-pending/container'
import ProfileEdit from './edit-profile/container'
import ProfileEditAvatar from './edit-avatar/container'
import ProfileGenericEnterUsername from './generic/enter-username/container'
import ProfileGenericProofResult from './generic/result/container'
import ProfilePostProof from './post-proof/container'
import ProfileProofsList from './generic/proofs-list/container'
import ProfileProveEnterUsername from './prove-enter-username/container'
import ProfileProveWebsiteChoice from './prove-website-choice/container'
import ProfileRevoke from './revoke/container'
import ProfileSearch from './search/container'
import ProfileShowcaseTeamOffer from './showcase-team-offer/container'

export const newRoutes = {
  profile: {getScreen: (): typeof Profile => require('./user/container').default},
  profileNonUser: {getScreen: (): typeof ProfileNonUser => require('./non-user-profile/container').default},
}

export const newModalRoutes = {
  profileAddToTeam: {getScreen: (): typeof ProfileAddToTeam => require('./add-to-team/container').default},
  profileBlockUser: {getScreen: (): typeof ProfileBlockUser => require('./block/container').default},
  profileConfirmOrPending: {
    getScreen: (): typeof ProfileConfirmOrPending => require('./confirm-or-pending/container').default,
  },
  profileEdit: {getScreen: (): typeof ProfileEdit => require('./edit-profile/container').default},
  profileEditAvatar: {getScreen: (): typeof ProfileEditAvatar => require('./edit-avatar/container').default},
  profileGenericEnterUsername: {
    getScreen: (): typeof ProfileGenericEnterUsername =>
      require('./generic/enter-username/container').default,
  },
  profileGenericProofResult: {
    getScreen: (): typeof ProfileGenericProofResult => require('./generic/result/container').default,
  },
  profilePostProof: {getScreen: (): typeof ProfilePostProof => require('./post-proof/container').default},
  profileProofsList: {
    getScreen: (): typeof ProfileProofsList => require('./generic/proofs-list/container').default,
  },
  profileProveEnterUsername: {
    getScreen: (): typeof ProfileProveEnterUsername => require('./prove-enter-username/container').default,
  },
  profileProveWebsiteChoice: {
    getScreen: (): typeof ProfileProveWebsiteChoice => require('./prove-website-choice/container').default,
  },
  profileRevoke: {getScreen: (): typeof ProfileRevoke => require('./revoke/container').default},
  profileSearch: {getScreen: (): typeof ProfileSearch => require('./search/container').default},
  // TODO broken connect
  profileShowcaseTeamOffer: {
    getScreen: (): typeof ProfileShowcaseTeamOffer => require('./showcase-team-offer/container').default,
  },
  ...PGPRoutes,
}
