import type TeamMemberNew from './team/member/index.new'
import type TeamsRoot from './container'
import type ContactRestricted from '../team-building/contact-restricted'
import type OpenTeamWarning from './team/settings-tab/open-team-warning'
import type RetentionWarning from './team/settings-tab/retention/warning/container'
import type GenerateLinkModal from './team/invites/generate-link'
import type TeamDeleteTeam from './delete-team/container'
import type DeleteChannel from './confirm-modals/delete-channel'
import type TeamAddEmoji from './emojis/add-emoji'
import type TeamAddEmojiAlias from './emojis/add-alias'
import type TeamChannel from './channel'
import type TeamEditTeamDescription from './edit-team-description'
import type TeamEditTeamInfo from './team/team-info'
import type TeamEditWelcomeMessage from './edit-team-welcome-message'
import type TeamInviteByEmail from './invite-by-email/container'
import type TeamInviteByContact from './invite-by-contact/container'
import type TeamInviteLinkJoin from './join-team/join-from-invite'
import type TeamJoinTeamDialog from './join-team/container'
import type TeamNewTeamDialog from './new-team/container'
import type TeamReallyLeaveTeam from './confirm-modals/really-leave-team/container'
import type TeamReallyRemoveMember from './confirm-modals/confirm-kick-out'
import type TeamReallyRemoveChannelMember from './confirm-modals/confirm-remove-from-channel'
import type TeamRename from './rename-team/container'
import type TeamsTeamBuilder from '../team-building/container'
import type TeamAddToChannels from './team/member/add-to-channels'
import type TeamEditChannel from './team/member/edit-channel'
import type TeamCreateChannels from './channel/create-channels'
import type TeamWizardTeamInfo from './new-team/wizard/new-team-info'
import type TeamWizardTeamPurpose from './new-team/wizard/team-purpose'
import type TeamWizardTeamSize from './new-team/wizard/make-big-team'
import type TeamWizardChannels from './new-team/wizard/create-channels'
import type TeamWizardSubteams from './new-team/wizard/create-subteams'
import type TeamWizardSubteamMembers from './new-team/wizard/add-subteam-members'
import type TeamAddToTeamFromWhere from './add-members-wizard/add-from-where'
import type TeamAddToTeamPhone from './add-members-wizard/add-phone'
import type TeamAddToTeamEmail from './add-members-wizard/add-email'
import type TeamAddToTeamContacts from './add-members-wizard/add-contacts.native'
import type TeamAddToTeamConfirm from './add-members-wizard/confirm'
import type TeamInviteHistory from './team/invites/invite-history'
import type Team from './team'
import type ExternalTeam from './external-team'

export const newRoutes = {
  team: {getScreen: (): typeof Team => require('./team').default},
  teamChannel: {
    getScreen: (): typeof TeamChannel => require('./channel').default,
  },
  teamExternalTeam: {getScreen: (): typeof ExternalTeam => require('./external-team').default},
  teamMember: {getScreen: (): typeof TeamMemberNew => require('./team/member/index.new').default},
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
