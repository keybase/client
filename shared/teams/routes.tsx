import {TeamScreenType} from './team/container'
import TeamMember from './team/member/container'
import TeamMemberNew from './team/member/index.new'
import TeamsRoot from './container'
import ContactRestricted from '../team-building/contact-restricted'
import RetentionWarning from './team/settings-tab/retention/warning/container'
import TeamDeleteTeam from './delete-team/container'
import TeamEditChannel from './channel/container'
import TeamEditTeamAvatar from '../profile/edit-avatar/container'
import TeamEditTeamDescription from './edit-team-description'
import TeamEditWelcomeMessage from './edit-team-welcome-message'
import TeamInviteByEmail from './invite-by-email/container'
import TeamInviteByContact from './invite-by-contact/container'
import TeamJoinTeamDialog from './join-team/container'
import TeamNewTeamDialog from './new-team/container'
import TeamReallyLeaveTeam from './really-leave-team/container'
import TeamReallyRemoveMember from './team/really-remove-member'
import TeamRename from './rename-team/container'
import TeamsTeamBuilder from '../team-building/container'
import flags from '../util/feature-flags'

export const newRoutes = {
  team: {getScreen: (): TeamScreenType => require('./team/container').default},
  teamChannel: {
    getScreen: (): typeof TeamEditChannel => require('./channel/container').default,
  },
  teamMember: flags.teamsRedesign
    ? {getScreen: (): typeof TeamMemberNew => require('./team/member/index.new').default}
    : {getScreen: (): typeof TeamMember => require('./team/member/container').default},
  // TODO connect broken
  teamsRoot: {getScreen: (): typeof TeamsRoot => require('./container').default},
}

export const newModalRoutes = {
  contactRestricted: {
    getScreen: (): typeof ContactRestricted => require('../team-building/contact-restricted').default,
  },
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
    getScreen: (): typeof TeamEditTeamDescription => require('./edit-team-description').default,
  },
  teamEditWelcomeMessage: {
    getScreen: (): typeof TeamEditWelcomeMessage => require('./edit-team-welcome-message').default,
  },
  teamInviteByContact: {
    getScreen: (): typeof TeamInviteByContact => require('./invite-by-contact/container').default,
  },
  teamInviteByEmail: {
    getScreen: (): typeof TeamInviteByEmail => require('./invite-by-email/container').default,
  },
  teamJoinTeamDialog: {
    getScreen: (): typeof TeamJoinTeamDialog => require('./join-team/container').default,
  },
  teamNewTeamDialog: {
    getScreen: (): typeof TeamNewTeamDialog => require('./new-team/container').default,
  },
  teamReallyLeaveTeam: {
    getScreen: (): typeof TeamReallyLeaveTeam => require('./really-leave-team/container').default,
  },
  teamReallyRemoveMember: {
    getScreen: (): typeof TeamReallyRemoveMember => require('./team/really-remove-member').default,
  },
  teamRename: {getScreen: (): typeof TeamRename => require('./rename-team/container').default},
  teamsTeamBuilder: {
    getScreen: (): typeof TeamsTeamBuilder => require('../team-building/container').default,
  },
}
