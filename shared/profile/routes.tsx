import {newRoutes as PGPRoutes} from './pgp/routes-sub'
import type {Question1Answer} from '../profile/wot-author'
import type Profile from './user/container'
import type ProfileAddToTeam from './add-to-team/container'
import type ProfileConfirmOrPending from './confirm-or-pending/container'
import type ProfileEdit from './edit-profile/container'
import type ProfileEditAvatar from './edit-avatar/container'
import type ProfileGenericEnterUsername from './generic/enter-username/container'
import type ProfileGenericProofResult from './generic/result/container'
import type ProfilePostProof from './post-proof/container'
import type ProfileProofsList from './generic/proofs-list/container'
import type ProfileProveEnterUsername from './prove-enter-username/container'
import type ProfileProveWebsiteChoice from './prove-website-choice/container'
import type ProfileRevoke from './revoke/container'
import type ProfileShowcaseTeamOffer from './showcase-team-offer/container'
import type {Question1Wrapper, Question2Wrapper, ReviewWrapper} from './wot-author'
import type * as ImagePicker from 'expo-image-picker'
import type * as Types from '../constants/types/teams'
import type {PlatformsExpandedType} from '../constants/types/more'
import type {SiteIconSet} from '../constants/types/tracker2'

export const newRoutes = {
  profile: {getScreen: (): typeof Profile => require('./user/container').default},
}

export const newModalRoutes = {
  profileAddToTeam: {getScreen: (): typeof ProfileAddToTeam => require('./add-to-team/container').default},
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
  profileShowcaseTeamOffer: {
    getScreen: (): typeof ProfileShowcaseTeamOffer => require('./showcase-team-offer/container').default,
  },
  profileWotAuthor: {
    getScreen: (): typeof Question1Wrapper => require('./wot-author').Question1Wrapper,
  },
  profileWotAuthorQ2: {
    getScreen: (): typeof Question2Wrapper => require('./wot-author').Question2Wrapper,
  },
  profileWotReview: {
    getScreen: (): typeof ReviewWrapper => require('./wot-author').ReviewWrapper,
  },
  ...PGPRoutes,
}

export type RootParamListProfile = {
  profileWotReview: {
    sigID: string // sigID of the vouch.
  }
  profileWotAuthor: {
    username: string
    guiID: string
  }
  profileWotAuthorQ2: {
    username: string
    guiID: string
    question1Answer: Question1Answer
  }
  profileAddToTeam: {
    username: string
  }
  profileEditAvatar: {
    // Mobile-only
    image?: ImagePicker.ImagePickerResult
    // Team-only
    sendChatNotification?: boolean
    showBack?: boolean
    teamID?: Types.TeamID
    createdTeam?: boolean
    wizard?: boolean
  }
  profileRevoke: {
    icon: SiteIconSet
    platform: PlatformsExpandedType
    platformHandle: string
    proofId: string
  }
  profile: {
    username: string
  }

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
