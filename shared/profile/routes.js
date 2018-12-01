// @flow
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import pgpRoutes from './pgp/routes'
import Profile from './container'
import AddToTeam from './add-to-team/container'
import EditProfile from './edit-profile/container'
import EditAvatar from './edit-avatar/container'
import EditAvatarPlaceholder from './edit-avatar-placeholder/container'
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
import * as WalletConstants from '../constants/wallets'
import SendForm from '../wallets/send-form/container'
import ConfirmForm from '../wallets/confirm-form/container'
import ChooseAsset from '../wallets/send-form/choose-asset/container'
import QRScan from '../wallets/qr-scan/container'

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

const profileRoute = makeRouteDefNode({
  children: {
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
    editAvatar: {
      component: EditAvatar,
      tags: makeLeafTags({layerOnTop: !isMobile}),
    },
    editAvatarPlaceholder: {
      component: EditAvatarPlaceholder,
    },
    editProfile: {
      component: EditProfile,
    },
    nonUserProfile: {
      children: {
        profile: () => profileRoute,
      },
      component: NonUserProfile,
    },
    pgp: pgpRoutes,
    profile: () => profileRoute,
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
    [WalletConstants.sendReceiveFormRouteKey]: {
      children: {
        [WalletConstants.confirmFormRouteKey]: {
          children: {},
          component: ConfirmForm,
          tags: makeLeafTags({hideStatusBar: true, layerOnTop: !isMobile, renderTopmostOnly: true}),
        },
        [WalletConstants.chooseAssetFormRouteKey]: {
          children: {},
          component: ChooseAsset,
          tags: makeLeafTags({hideStatusBar: true, layerOnTop: !isMobile, renderTopmostOnly: true}),
        },
        qrScan: {
          component: QRScan,
          tags: makeLeafTags({hideStatusBar: true, layerOnTop: true}),
        },
      },
      component: SendForm,
      tags: makeLeafTags({hideStatusBar: true, layerOnTop: !isMobile, renderTopmostOnly: true}),
    },
  },
  component: Profile,
  initialState: {currentFriendshipsTab: 'Followers'},
  tags: makeLeafTags({title: 'Profile', underNotch: true}),
})

export default profileRoute
