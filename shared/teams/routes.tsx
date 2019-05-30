import {MaybePopupHoc} from '../common-adapters'

export const newRoutes = {
  team: {getScreen: () => require('./team/container').default, upgraded: true},
  teamMember: {getScreen: () => require('./team/member/container').default, upgraded: true},
  teamsRoot: {getScreen: () => require('./container').default, upgraded: true},
}

export const newModalRoutes = {
  retentionWarning: {
    getScreen: () => require('./team/settings-tab/retention/warning/container').default,
    upgraded: true,
  },
  teamAddPeople: {getScreen: () => require('./add-people/container').default, upgraded: true},
  teamDeleteTeam: {getScreen: () => require('./delete-team/container').default, upgraded: true},
  teamEditTeamAvatar: {getScreen: () => require('../profile/edit-avatar/container').default, upgraded: true},
  teamEditTeamDescription: {
    getScreen: () => MaybePopupHoc(false)(require('./edit-team-description/container').default),
    upgraded: true,
  },
  teamInviteByEmail: {getScreen: () => require('./invite-by-email/container').default, upgraded: true},
  teamJoinTeamDialog: {getScreen: () => require('./join-team/container').default, upgraded: true},
  teamNewTeamDialog: {getScreen: () => require('./new-team/container').default, upgraded: true},
  teamReallyLeaveTeam: {getScreen: () => require('./really-leave-team/container').default, upgraded: true},
  teamReallyRemoveMember: {
    getScreen: () => require('./team/really-remove-member/container').default,
    upgraded: true,
  },
  teamRename: {
    getScreen: () => require('./rename-team/container').default,
    upgraded: true,
  },
}
