// @flow
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import pgpRoutes from './pgp/routes'
import Profile from './container'
import AddToTeam from './add-to-team/container'
import EditProfile from './edit-profile/container'
import EditAvatar from './edit-avatar/container'
import ProveEnterUsername from './prove-enter-username/container'
import ProveWebsiteChoice from './prove-website-choice/container'
import RevokeContainer from './revoke/container'
import PostProof from './post-proof/container'
import ConfirmOrPending from './confirm-or-pending/container'
import SearchPopup from './search/container'
import {isMobile} from '../constants/platform'
import NonUserProfile from './non-user-profile/container'
import ShowcaseTeamOffer from './showcase-team-offer/container'
import ControlledRolePicker from '../teams/role-picker/controlled-container'

const proveEnterUsername = makeRouteDefNode({
  component: ProveEnterUsername,
  children: {
    postProof: {
      component: PostProof,
      children: {
        confirmOrPending: {
          component: ConfirmOrPending,
        },
      },
    },
    confirmOrPending: {
      component: ConfirmOrPending,
    },
  },
})

const profileRoute = makeRouteDefNode({
  component: Profile,
  initialState: {currentFriendshipsTab: 'Followers'},
  tags: makeLeafTags({underStatusBar: true, title: 'Profile'}),
  children: {
    profile: () => profileRoute,
    addToTeam: {
      children: {
        controlledRolePicker: {
          children: {},
          component: ControlledRolePicker,
          tags: makeLeafTags({layerOnTop: !isMobile}),
        },
      },
      component: AddToTeam,
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
    editProfile: {
      component: EditProfile,
    },
    editAvatar: {
      component: EditAvatar,
    },
    nonUserProfile: {
      component: NonUserProfile,
      children: {
        profile: () => profileRoute,
      },
    },
    proveEnterUsername,
    proveWebsiteChoice: {
      component: ProveWebsiteChoice,
      children: {
        proveEnterUsername,
      },
    },
    revoke: {
      component: RevokeContainer,
    },
    pgp: pgpRoutes,
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
  },
})

export default profileRoute
