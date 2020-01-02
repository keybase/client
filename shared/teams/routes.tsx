import Team from './team/container'
import TeamMember from './team/member/container'
import TeamsRoot from './container'
import RetentionWarning from './team/settings-tab/retention/warning/container'
import TeamDeleteTeam from './delete-team/container'
import TeamEditTeamAvatar from '../profile/edit-avatar/container'
import TeamEditTeamDescription from './edit-team-description/container'
import TeamInviteByEmail from './invite-by-email/container'
import TeamInviteByContact from './invite-by-contact/container'
import TeamJoinTeamDialog from './join-team/container'
import TeamNewTeamDialog from './new-team/container'
import TeamReallyLeaveTeam from './really-leave-team/container'
import TeamReallyRemoveMember from './team/really-remove-member'
import TeamRename from './rename-team/container'
import TeamsTeamBuilder from '../team-building/container'

export const newRoutes = {
  team: {getScreen: (): typeof Team => require('./team/container').default},
  teamMember: {getScreen: (): typeof TeamMember => require('./team/member/container').default},
  // TODO connect broken
  teamsRoot: {getScreen: (): typeof TeamsRoot => require('./container').default},
}

export const newModalRoutes = {
  // TODO connect broken
  retentionWarning: {
    getScreen: (): typeof RetentionWarning =>
      require('./team/settings-tab/retention/warning/container').default,
  },
  teamDeleteTeam: {getScreen: (): typeof TeamDeleteTeam => require('./delete-team/container').default},
  teamEditTeamAvatar: {
    getScreen: (): typeof TeamEditTeamAvatar => require('../profile/edit-avatar/container').default,
  },
  teamEditTeamDescription: {
    getScreen: (): typeof TeamEditTeamDescription => require('./edit-team-description/container').default,
  },
  teamInviteByContact: {
    getScreen: (): typeof TeamInviteByContact => require('./invite-by-contact/container').default,
  },
  teamInviteByEmail: {
    getScreen: (): typeof TeamInviteByEmail => require('./invite-by-email/container').default,
  },
  // TODO connect broken
  teamJoinTeamDialog: {getScreen: (): typeof TeamJoinTeamDialog => require('./join-team/container').default},
  // TODO connect broken
  teamNewTeamDialog: {getScreen: (): typeof TeamNewTeamDialog => require('./new-team/container').default},
  teamReallyLeaveTeam: {
    getScreen: (): typeof TeamReallyLeaveTeam => require('./really-leave-team/container').default,
  },
  teamReallyRemoveMember: {
    getScreen: (): typeof TeamReallyRemoveMember => require('./team/really-remove-member').default,
  },
  teamRename: {getScreen: (): typeof TeamRename => require('./rename-team/container').default},
  teamsTeamBuilder: {getScreen: (): typeof TeamsTeamBuilder => require('../team-building/container').default},
}
