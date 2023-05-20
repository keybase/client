import contactRestricted from '../team-building/contact-restricted.page'
import openTeamWarning from './team/settings-tab/open-team-warning/page'
import retentionWarning from './team/settings-tab/retention/warning/page'
import team from './team/page'
import teamAddEmoji from './emojis/add-emoji.page'
import teamAddEmojiAlias from './emojis/add-alias.page'
import teamAddToChannels from './team/member/add-to-channels.page'
import teamAddToTeamConfirm from './add-members-wizard/confirm.page'
import teamAddToTeamContacts from './add-members-wizard/add-contacts.page'
import teamAddToTeamEmail from './add-members-wizard/add-email.page'
import teamAddToTeamFromWhere from './add-members-wizard/add-from-where.page'
import teamAddToTeamPhone from './add-members-wizard/add-phone.page'
import teamChannel from './channel/page'
import teamCreateChannels from './channel/create-channels.page'
import teamDeleteChannel from './confirm-modals/delete-channel/page'
import teamDeleteTeam from './delete-team/page'
import teamEditChannel from './team/member/edit-channel.page'
import teamEditTeamDescription from './edit-team-description/page'
import teamEditTeamInfo from './team/team-info.page'
import teamEditWelcomeMessage from './edit-team-welcome-message/page'
import teamExternalTeam from './external-team.page'
import teamInviteByContact from './invite-by-contact/page'
import teamInviteByEmail from './invite-by-email/page'
import teamInviteHistory from './team/invites/invite-history.page'
import teamInviteLinkJoin from './join-team/join-from-invite.page'
import teamInviteLinksGenerate from './team/invites/generate-link.page'
import teamJoinTeamDialog from './join-team/page'
import teamMember from './team/member/index.new.page'
import teamNewTeamDialog from './new-team/page'
import teamReallyLeaveTeam from './confirm-modals/really-leave-team/page'
import teamReallyRemoveChannelMember from './confirm-modals/confirm-remove-from-channel.page'
import teamReallyRemoveMember from './confirm-modals/confirm-kick-out.page'
import teamRename from './rename-team/page'
import teamWizard1TeamPurpose from './new-team/wizard/team-purpose.page'
import teamWizard2TeamInfo from './new-team/wizard/new-team-info.page'
import teamWizard4TeamSize from './new-team/wizard/make-big-team.page'
import teamWizard5Channels from './new-team/wizard/create-channels.page'
import teamWizard6Subteams from './new-team/wizard/create-subteams.page'
import teamWizardSubteamMembers from './new-team/wizard/add-subteam-members.page'
import teamsRoot from './page'
import teamsTeamBuilder from '../team-building/page'
import type * as Container from '../util/container'

export const newRoutes = {
  team,
  teamChannel,
  teamExternalTeam,
  teamMember,
  teamsRoot,
}

export const newModalRoutes = {
  contactRestricted,
  openTeamWarning,
  retentionWarning,
  teamAddEmoji,
  teamAddEmojiAlias,
  teamAddToChannels,
  teamAddToTeamConfirm,
  teamAddToTeamContacts,
  teamAddToTeamEmail,
  teamAddToTeamFromWhere,
  teamAddToTeamPhone,
  teamCreateChannels,
  teamDeleteChannel,
  teamDeleteTeam,
  teamEditChannel,
  teamEditTeamDescription,
  teamEditTeamInfo,
  teamEditWelcomeMessage,
  teamInviteByContact,
  teamInviteByEmail,
  teamInviteHistory,
  teamInviteLinkJoin,
  teamInviteLinksGenerate,
  teamJoinTeamDialog,
  teamNewTeamDialog,
  teamReallyLeaveTeam,
  teamReallyRemoveChannelMember,
  teamReallyRemoveMember,
  teamRename,
  teamWizard1TeamPurpose,
  teamWizard2TeamInfo,
  teamWizard4TeamSize,
  teamWizard5Channels,
  teamWizard6Subteams,
  teamWizardSubteamMembers,
  teamsTeamBuilder,
}

export type RootParamListTeams = Container.PagesToParams<typeof newRoutes & typeof newModalRoutes>
