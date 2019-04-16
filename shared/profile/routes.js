// @flow
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import {isMobile} from '../constants/platform'

const profileRoute = () => {
  const pgpRoutes = require('./pgp/routes').default
  const Profile = require('./user/container').default
  const AddToTeam = require('./add-to-team/container').default
  const EditProfile = require('./edit-profile/container').default
  const EditAvatar = require('./edit-avatar/container').default
  const ProveEnterUsername = require('./prove-enter-username/container').default
  const ProveWebsiteChoice = require('./prove-website-choice/container').default
  const RevokeContainer = require('./revoke/container').default
  const PostProof = require('./post-proof/container').default
  const ConfirmOrPending = require('./confirm-or-pending/container').default
  const SearchPopup = require('./search/container').default
  const NonUserProfile = require('./non-user-profile/container').default
  const ShowcaseTeamOffer = require('./showcase-team-offer/container').default
  const ControlledRolePicker = require('../teams/role-picker/controlled-container').default
  const WalletConstants = require('../constants/wallets')
  const ProofsList = require('./generic/proofs-list/container').default
  const GenericEnterUsername = require('./generic/enter-username/container').default
  const GenericProofSuccess = require('./generic/success/container').default

  const SendRequestFormRoutes = require('../wallets/routes-send-request-form').default()

  const proveEnterUsername = makeRouteDefNode({
    children: {
      profileConfirmOrPending: {component: ConfirmOrPending},
      profilePostProof: {
        children: {
          profileConfirmOrPending: {component: ConfirmOrPending},
        },
        component: PostProof,
      },
    },
    component: ProveEnterUsername,
  })

  const profileGenericEnterUsername = {
    children: {
      profileGenericProofSuccess: {
        component: GenericProofSuccess,
        tags: makeLeafTags({layerOnTop: !isMobile, renderTopmostOnly: true}),
      },
    },
    component: GenericEnterUsername,
    tags: makeLeafTags({layerOnTop: !isMobile, renderTopmostOnly: true}),
  }

  return makeRouteDefNode({
    children: {
      profile: profileRoute,
      profileAddToTeam: {
        children: {
          teamControlledRolePicker: {
            children: {},
            component: ControlledRolePicker,
            tags: makeLeafTags({fullscreen: isMobile, layerOnTop: !isMobile}),
          },
        },
        component: AddToTeam,
        tags: makeLeafTags({fullscreen: isMobile, layerOnTop: !isMobile}),
      },
      profileEdit: {
        component: EditProfile,
        tags: makeLeafTags({layerOnTop: !isMobile, renderTopmostOnly: true}),
      },
      profileEditAvatar: {
        component: EditAvatar,
        tags: makeLeafTags({layerOnTop: !isMobile}),
      },
      profileGenericEnterUsername,
      profileNonUser: {
        children: {profile: profileRoute},
        component: NonUserProfile,
      },
      profilePgp: pgpRoutes,
      profileProofsList: {
        children: {
          profileGenericEnterUsername,
        },
        component: ProofsList,
        tags: makeLeafTags({layerOnTop: !isMobile, renderTopmostOnly: true}),
      },
      profileProveEnterUsername: proveEnterUsername,
      profileProveWebsiteChoice: {
        children: {proveEnterUsername},
        component: ProveWebsiteChoice,
      },
      profileRevoke: {component: RevokeContainer},
      profileSearch: {
        children: {},
        component: SearchPopup,
        tags: makeLeafTags({layerOnTop: !isMobile}),
      },
      profileShowcaseTeamOffer: {
        children: {},
        component: ShowcaseTeamOffer,
        tags: makeLeafTags({layerOnTop: !isMobile}),
      },
      [WalletConstants.sendRequestFormRouteKey]: SendRequestFormRoutes,
    },
    component: Profile,
    initialState: {currentFriendshipsTab: 'Followers'},
    tags: makeLeafTags({title: 'Profile', underNotch: true}),
  })
}

export const newRoutes = {
  profile: {getScreen: () => require('./user/container').default, upgraded: true},
  profileNonUser: {getScreen: () => require('./non-user-profile/container').default},
}

export const newModalRoutes = {
  profileAddToTeam: {getScreen: () => require('./add-to-team/container').default, upgraded: true},
  profileConfirmOrPending: {
    getScreen: () => require('./confirm-or-pending/container').default,
    upgraded: true,
  },
  profileEdit: {getScreen: () => require('./edit-profile/container').default},
  profileEditAvatar: {getScreen: () => require('./edit-avatar/container').default, upgraded: true},
  profileGenericEnterUsername: {
    getScreen: () => require('./generic/enter-username/container').default,
    upgraded: true,
  },
  profileGenericProofSuccess: {
    getScreen: () => require('./generic/success/container').default,
    upgraded: true,
  },
  profilePostProof: {getScreen: () => require('./post-proof/container').default, upgraded: true},
  profileProofsList: {getScreen: () => require('./generic/proofs-list/container').default, upgraded: true},
  profileProveEnterUsername: {
    getScreen: () => require('./prove-enter-username/container').default,
    upgraded: true,
  },
  profileProveWebsiteChoice: {
    getScreen: () => require('./prove-website-choice/container').default,
    upgraded: true,
  },
  profileRevoke: {getScreen: () => require('./revoke/container').default, upgraded: true},
  profileSearch: {getScreen: () => require('./search/container').default},
  profileShowcaseTeamOffer: {
    getScreen: () => require('./showcase-team-offer/container').default,
    upgraded: true,
  },
  teamControlledRolePicker: {getScreen: () => require('../teams/role-picker/controlled-container').default},
  ...require('./pgp/routes').newRoutes,
}

export default profileRoute
