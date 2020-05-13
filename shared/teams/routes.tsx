import TeamMember from './team/member/container'
import TeamMemberNew from './team/member/index.new'
import TeamsRoot from './container'
import ContactRestricted from '../team-building/contact-restricted'
import OpenTeamWarning from './team/settings-tab/open-team-warning'
import RetentionWarning from './team/settings-tab/retention/warning/container'
import GenerateLinkModal from './team/invites/generate-link'
import TeamDeleteTeam from './delete-team/container'
import DeleteChannel from './confirm-modals/delete-channel'
import TeamAddEmoji from './emojis/add-emoji'
import TeamAddEmojiAlias from './emojis/add-alias'
import TeamChannel from './channel'
import TeamEditTeamDescription from './edit-team-description'
import TeamEditTeamInfo from './team/team-info'
import TeamEditWelcomeMessage from './edit-team-welcome-message'
import TeamInviteByEmail from './invite-by-email/container'
import TeamInviteByContact from './invite-by-contact/container'
import TeamInviteLinkJoin from './join-team/join-from-invite'
import TeamJoinTeamDialog from './join-team/container'
import TeamNewTeamDialog from './new-team/container'
import TeamReallyLeaveTeam from './confirm-modals/really-leave-team/container'
import TeamReallyRemoveMember from './confirm-modals/confirm-kick-out'
import TeamReallyRemoveChannelMember from './confirm-modals/confirm-remove-from-channel'
import TeamRename from './rename-team/container'
import TeamsTeamBuilder from '../team-building/container'
import TeamAddToChannels from './team/member/add-to-channels'
import TeamEditChannel from './team/member/edit-channel'
import TeamCreateChannels from './channel/create-channels'
import TeamWizardTeamInfo from './new-team/wizard/new-team-info'
import TeamWizardTeamPurpose from './new-team/wizard/team-purpose'
import TeamWizardTeamSize from './new-team/wizard/make-big-team'
import TeamWizardChannels from './new-team/wizard/create-channels'
import TeamWizardSubteams from './new-team/wizard/create-subteams'
import TeamWizardSubteamMembers from './new-team/wizard/add-subteam-members'
import TeamAddToTeamFromWhere from './add-members-wizard/add-from-where'
import TeamAddToTeamPhone from './add-members-wizard/add-phone'
import TeamAddToTeamEmail from './add-members-wizard/add-email'
import TeamAddToTeamContacts from './add-members-wizard/add-contacts.native'
import TeamAddToTeamConfirm from './add-members-wizard/confirm'
import TeamInviteHistory from './team/invites/invite-history'
import Team from './team'
import ExternalTeam from './external-team'
import flags from '../util/feature-flags'

export const newRoutes = {
  team: {getScreen: (): typeof Team => require('./team').default},
  teamChannel: {
    getScreen: (): typeof TeamChannel => require('./channel').default,
  },
  teamExternalTeam: {getScreen: (): typeof ExternalTeam => require('./external-team').default},
  teamMember: flags.teamsRedesign
    ? {getScreen: (): typeof TeamMemberNew => require('./team/member/index.new').default}
    : {getScreen: (): typeof TeamMember => require('./team/member/container').default},
  teamsRoot: {getScreen: (): typeof TeamsRoot => require('./container').default},
}

const addWizardRoutes = {
  teamAddToTeamConfirm: {
    getScreen: (): typeof TeamAddToTeamConfirm => require('./add-members-wizard/confirm').default,
  },
  teamAddToTeamContacts: {
    getScreen: (): typeof TeamAddToTeamContacts => require('./add-members-wizard/add-contacts').default,
  },
  teamAddToTeamEmail: {
    getScreen: (): typeof TeamAddToTeamEmail => require('./add-members-wizard/add-email').default,
  },
  teamAddToTeamFromWhere: {
    getScreen: (): typeof TeamAddToTeamFromWhere => require('./add-members-wizard/add-from-where').default,
  },
  teamAddToTeamPhone: {
    getScreen: (): typeof TeamAddToTeamPhone => require('./add-members-wizard/add-phone').default,
  },
}

const newTeamWizardRoutes = {
  teamWizard1TeamPurpose: {
    getScreen: (): typeof TeamWizardTeamPurpose => require('./new-team/wizard/team-purpose').default,
  },
  teamWizard2TeamInfo: {
    getScreen: (): typeof TeamWizardTeamInfo => require('./new-team/wizard/new-team-info').default,
  },
  teamWizard4TeamSize: {
    getScreen: (): typeof TeamWizardTeamSize => require('./new-team/wizard/make-big-team').default,
  },
  teamWizard5Channels: {
    getScreen: (): typeof TeamWizardChannels => require('./new-team/wizard/create-channels').default,
  },
  teamWizard6Subteams: {
    getScreen: (): typeof TeamWizardSubteams => require('./new-team/wizard/create-subteams').default,
  },
  teamWizardSubteamMembers: {
    getScreen: (): typeof TeamWizardSubteamMembers =>
      require('./new-team/wizard/add-subteam-members').default,
  },
}

export const newModalRoutes = {
  ...addWizardRoutes,
  ...newTeamWizardRoutes,
  contactRestricted: {
    getScreen: (): typeof ContactRestricted => require('../team-building/contact-restricted').default,
  },
  openTeamWarning: {
    getScreen: (): typeof OpenTeamWarning => require('./team/settings-tab/open-team-warning').default,
  },
  retentionWarning: {
    getScreen: (): typeof RetentionWarning =>
      require('./team/settings-tab/retention/warning/container').default,
  },
  teamAddEmoji: {
    getScreen: (): typeof TeamAddEmoji => require('./emojis/add-emoji').default,
  },
  teamAddEmojiAlias: {
    getScreen: (): typeof TeamAddEmojiAlias => require('./emojis/add-alias').default,
  },
  teamAddToChannels: {
    getScreen: (): typeof TeamAddToChannels => require('./team/member/add-to-channels').default,
  },
  teamCreateChannels: {
    getScreen: (): typeof TeamCreateChannels => require('./channel/create-channels').default,
  },
  teamDeleteChannel: {
    getScreen: (): typeof DeleteChannel => require('./confirm-modals/delete-channel').default,
  },
  teamDeleteTeam: {getScreen: (): typeof TeamDeleteTeam => require('./delete-team/container').default},
  teamEditChannel: {
    getScreen: (): typeof TeamEditChannel => require('./team/member/edit-channel').default,
  },
  teamEditTeamDescription: {
    getScreen: (): typeof TeamEditTeamDescription => require('./edit-team-description').default,
  },
  teamEditTeamInfo: {
    getScreen: (): typeof TeamEditTeamInfo => require('./team/team-info').default,
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
  teamInviteHistory: {
    getScreen: (): typeof TeamInviteHistory => require('./team/invites/invite-history').default,
  },
  teamInviteLinkJoin: {
    getScreen: (): typeof TeamInviteLinkJoin => require('./join-team/join-from-invite').default,
  },
  teamInviteLinksGenerate: {
    getScreen: (): typeof GenerateLinkModal => require('./team/invites/generate-link').default,
  },
  teamJoinTeamDialog: {
    getScreen: (): typeof TeamJoinTeamDialog => require('./join-team/container').default,
  },
  teamNewTeamDialog: {
    getScreen: (): typeof TeamNewTeamDialog => require('./new-team/container').default,
  },
  teamReallyLeaveTeam: {
    getScreen: (): typeof TeamReallyLeaveTeam =>
      require('./confirm-modals/really-leave-team/container').default,
  },
  teamReallyRemoveChannelMember: {
    getScreen: (): typeof TeamReallyRemoveChannelMember =>
      require('./confirm-modals/confirm-remove-from-channel').default,
  },
  teamReallyRemoveMember: {
    getScreen: (): typeof TeamReallyRemoveMember => require('./confirm-modals/confirm-kick-out').default,
  },
  teamRename: {getScreen: (): typeof TeamRename => require('./rename-team/container').default},
  teamsTeamBuilder: {
    getScreen: (): typeof TeamsTeamBuilder => require('../team-building/container').default,
  },
}
