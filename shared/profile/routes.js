// @flow
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import pgpRoutes from './pgp/routes'
import Profile from './container'
import EditProfile from './edit-profile'
import EditAvatar from './edit-avatar-container'
import ProveEnterUsername from './prove-enter-username-container'
import ProveWebsiteChoice from './prove-website-choice-container'
import RevokeContainer from './revoke/container'
import PostProof from './post-proof-container'
import ConfirmOrPending from './confirm-or-pending-container'
import SearchPopup from './search-container'
import {isMobile} from '../constants/platform'
import NonUserProfile from './non-user-profile-container'

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

export const profileRoute = makeRouteDefNode({
  component: Profile,
  initialState: {currentFriendshipsTab: 'Followers'},
  tags: makeLeafTags({underStatusBar: true, title: 'Profile'}),
  children: {
    profile: () => profileRoute,
    editProfile: {
      component: EditProfile,
    },
    editAvatar: {
      component: EditAvatar,
    },
    nonUserProfile: {
      component: NonUserProfile,
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
  },
})

export default profileRoute
