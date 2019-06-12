export const newRoutes = {
  profile: {getScreen: () => require('./user/container').default, upgraded: true},
  profileNonUser: {getScreen: () => require('./non-user-profile/container').default},
}

export const newModalRoutes = {
  profileAddToTeam: {getScreen: () => require('./add-to-team/container').default, upgraded: true},
  profileBlockUser: {getScreen: () => require('./block/container').default, upgraded: true},
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
  ...require('./pgp/routes').newRoutes,
}
