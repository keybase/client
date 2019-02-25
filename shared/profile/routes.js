// @flow
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import {isMobile} from '../constants/platform'
import flags from '../util/feature-flags'

const profileRoute = () => {
  const pgpRoutes = require('./pgp/routes').default
  const Profile = flags.identify3 ? require('./user/container').default : require('./container').default
  const AddToTeam = require('./add-to-team/container').default
  // TODO deprecate
  const EditProfile = require('./edit-profile/container').default
  const EditProfile2 = require('./edit-profile2/container').default
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

  const SendRequestFormRoutes = require('../wallets/routes-send-request-form').default()

  const proveEnterUsername = makeRouteDefNode({
    children: {
      confirmOrPending: {
        component: ConfirmOrPending,
      },
      postProof: {
        children: {
          confirmOrPending: {
            component: ConfirmOrPending,
          },
        },
        component: PostProof,
      },
    },
    component: ProveEnterUsername,
  })

  return makeRouteDefNode({
    children: {
      addToTeam: {
        children: {
          controlledRolePicker: {
            children: {},
            component: ControlledRolePicker,
            tags: makeLeafTags({fullscreen: isMobile, layerOnTop: !isMobile}),
          },
        },
        component: AddToTeam,
        tags: makeLeafTags({fullscreen: isMobile, layerOnTop: !isMobile}),
      },
      editAvatar: {
        component: EditAvatar,
        tags: makeLeafTags({layerOnTop: !isMobile}),
      },
      editProfile: {
        component: EditProfile,
      },
      editProfile2: {
        component: EditProfile2,
        tags: makeLeafTags({layerOnTop: !isMobile, renderTopmostOnly: true}),
      },
      nonUserProfile: {
        children: {
          profile: profileRoute,
        },
        component: NonUserProfile,
      },
      pgp: pgpRoutes,
      profile: profileRoute,
      proveEnterUsername,
      proveWebsiteChoice: {
        children: {
          proveEnterUsername,
        },
        component: ProveWebsiteChoice,
      },
      revoke: {
        component: RevokeContainer,
      },
      search: {
        children: {},
        component: SearchPopup,
        tags: makeLeafTags({layerOnTop: !isMobile}),
      },
      showcaseTeamOffer: {
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
  addToTeam: {getScreen: () => require('./add-to-team/container').default},
  confirmOrPending: {getScreen: () => require('./confirm-or-pending/container').default},
  editAvatar: {getScreen: () => require('./edit-avatar/container').default},
  editProfile: {getScreen: () => require('./edit-profile/container').default},
  nonUserProfile: {getScreen: () => require('./non-user-profile/container').default},
  postProof: {getScreen: () => require('./post-proof/container').default},
  profile: {
    getScreen: () => (flags.identify3 ? require('./user/container').default : require('./container').default),
    upgraded: true,
  },
  proveEnterUsername: {getScreen: () => require('./prove-enter-username/container').default},
  proveWebsiteChoice: {getScreen: () => require('./prove-website-choice/container').default},
  revoke: {getScreen: () => require('./revoke/container').default},
  showcaseTeamOffer: {getScreen: () => require('./showcase-team-offer/container').default},
  ...require('./pgp/routes').newRoutes,
}

export const newModalRoutes = {
  search: {getScreen: () => require('./search/container').default},
}

export default profileRoute
