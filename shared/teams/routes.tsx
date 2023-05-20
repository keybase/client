import type * as Container from '../util/container'
import team from './team/page'
import teamsRoot from './page'
import teamChannel from './channel/page'
import teamExternalTeam from './external-team.page'
import teamMember from './team/member/index.new.page'
import teamAddToTeamConfirm from './add-members-wizard/confirm.page'
import teamsTeamBuilder from '../team-building/page'
import teamAddToTeamContacts from './add-members-wizard/add-contacts.page'
import teamAddToTeamEmail from './add-members-wizard/add-email.page'
import teamAddToTeamFromWhere from './add-members-wizard/add-from-where.page'
import teamAddToTeamPhone from './add-members-wizard/add-phone.page'

export const newRoutes = {
  team,
  teamChannel,
  teamExternalTeam,
  teamMember,
  teamsRoot,
}

const addWizardRoutes = {
  teamAddToTeamConfirm,
  teamAddToTeamContacts,
  teamAddToTeamEmail,
  teamAddToTeamFromWhere,
  teamAddToTeamPhone,
}

const newTeamWizardRoutes = {
  teamWizard1TeamPurpose: {
    getScreen: () => require('./new-team/wizard/team-purpose').default,
  },
  teamWizard2TeamInfo: {
    getScreen: () => require('./new-team/wizard/new-team-info').default,
  },
  teamWizard4TeamSize: {
    getScreen: () => require('./new-team/wizard/make-big-team').default,
  },
  teamWizard5Channels: {
    getScreen: () => require('./new-team/wizard/create-channels').default,
  },
  teamWizard6Subteams: {
    getScreen: () => require('./new-team/wizard/create-subteams').default,
  },
  teamWizardSubteamMembers: {
    getScreen: () => require('./new-team/wizard/add-subteam-members').default,
  },
}

export const newModalRoutes = {
  ...addWizardRoutes,
  ...newTeamWizardRoutes,
  contactRestricted: {
    getScreen: () => require('../team-building/contact-restricted').default,
  },
  openTeamWarning: {
    getScreen: () => require('./team/settings-tab/open-team-warning').default,
  },
  retentionWarning: {
    getScreen: () => require('./team/settings-tab/retention/warning/container').default,
  },
  teamAddEmoji: {
    getScreen: () => require('./emojis/add-emoji').default,
  },
  teamAddEmojiAlias: {
    getScreen: () => require('./emojis/add-alias').default,
  },
  teamAddToChannels: {
    getScreen: () => require('./team/member/add-to-channels').default,
  },
  teamCreateChannels: {
    getScreen: () => require('./channel/create-channels').default,
  },
  teamDeleteChannel: {
    getScreen: () => require('./confirm-modals/delete-channel').default,
  },
  teamDeleteTeam: {getScreen: () => require('./delete-team/container').default},
  teamEditChannel: {
    getScreen: () => require('./team/member/edit-channel').default,
  },
  teamEditTeamDescription: {
    getScreen: () => require('./edit-team-description').default,
  },
  teamEditTeamInfo: {
    getScreen: () => require('./team/team-info').default,
  },
  teamEditWelcomeMessage: {
    getScreen: () => require('./edit-team-welcome-message').default,
  },
  teamInviteByContact: {
    getScreen: () => require('./invite-by-contact/container').default,
  },
  teamInviteByEmail: {
    getScreen: () => require('./invite-by-email/container').default,
  },
  teamInviteHistory: {
    getScreen: () => require('./team/invites/invite-history').default,
  },
  teamInviteLinkJoin: {
    getScreen: () => require('./join-team/join-from-invite').default,
  },
  teamInviteLinksGenerate: {
    getScreen: () => require('./team/invites/generate-link').default,
  },
  teamJoinTeamDialog: {
    getScreen: () => require('./join-team/container').default,
  },
  teamNewTeamDialog: {
    getScreen: () => require('./new-team/container').default,
  },
  teamReallyLeaveTeam: {
    getScreen: () => require('./confirm-modals/really-leave-team/container').default,
  },
  teamReallyRemoveChannelMember: {
    getScreen: () => require('./confirm-modals/confirm-remove-from-channel').default,
  },
  teamReallyRemoveMember: {
    getScreen: () => require('./confirm-modals/confirm-kick-out').default,
  },
  teamRename: {getScreen: () => require('./rename-team/container').default},
  teamsTeamBuilder,
}

export type RootParamListTeams = Container.PagesToParams<typeof newRoutes & typeof newModalRoutes>
