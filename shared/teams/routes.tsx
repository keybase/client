import {MaybePopupHoc} from '../common-adapters'
import Team from './team/container'
import TeamMember from './team/member/container'
import TeamsRoot from './container'
import RetentionWarning from './team/settings-tab/retention/warning/container'
import TeamDeleteTeam from './delete-team/container'
import TeamEditTeamAvatar from '../profile/edit-avatar/container'
import TeamEditTeamDescription from './edit-team-description/container'
import TeamInviteByEmail from './invite-by-email/container'
import TeamJoinTeamDialog from './join-team/container'
import TeamNewTeamDialog from './new-team/container'
import TeamReallyLeaveTeam from './really-leave-team/container'
import TeamReallyRemoveMember from './team/really-remove-member/container'
import TeamRename from './rename-team/container'
import TeamsTeamBuilder from '../team-building/container'

export const newRoutes = {
  team: {getScreen: (): typeof Team => require('./team/container').default, upgraded: true},
  teamMember: {
    getScreen: (): typeof TeamMember => require('./team/member/container').default,
    upgraded: true,
  },
  // TODO connect broken
  teamsRoot: {getScreen: (): typeof TeamsRoot => require('./container').default, upgraded: true},
}

export const newModalRoutes = {
  retentionWarning: {
    // TODO connect broken
    getScreen: (): typeof RetentionWarning =>
      require('./team/settings-tab/retention/warning/container').default,
    upgraded: true,
  },
  teamDeleteTeam: {
    // TODO connect broken
    getScreen: (): typeof TeamDeleteTeam => require('./delete-team/container').default,
    upgraded: true,
  },
  teamEditTeamAvatar: {
    getScreen: (): typeof TeamEditTeamAvatar => require('../profile/edit-avatar/container').default,
    upgraded: true,
  },
  // TODO connect broken
  teamEditTeamDescription: {
    getScreen: (): typeof TeamEditTeamDescription =>
      MaybePopupHoc(false)(require('./edit-team-description/container').default),
    upgraded: true,
  },
  teamInviteByEmail: {
    getScreen: (): typeof TeamInviteByEmail => require('./invite-by-email/container').default,
    upgraded: true,
  },
  // TODO connect broken
  teamJoinTeamDialog: {
    getScreen: (): typeof TeamJoinTeamDialog => require('./join-team/container').default,
    upgraded: true,
  },
  // TODO connect broken
  teamNewTeamDialog: {
    getScreen: (): typeof TeamNewTeamDialog => require('./new-team/container').default,
    upgraded: true,
  },
  // TODO connect broken
  teamReallyLeaveTeam: {
    getScreen: (): typeof TeamReallyLeaveTeam => require('./really-leave-team/container').default,
    upgraded: true,
  },
  teamReallyRemoveMember: {
    getScreen: (): typeof TeamReallyRemoveMember => require('./team/really-remove-member/container').default,
    upgraded: true,
  },
  teamRename: {
    getScreen: (): typeof TeamRename => require('./rename-team/container').default,
    upgraded: true,
  },
  teamsTeamBuilder: {
    getScreen: (): typeof TeamsTeamBuilder => require('../team-building/container').default,
    upgraded: true,
  },
}
