import * as React from 'react'
import * as C from '@/constants'
import * as Container from '@/util/container'
import * as Kb from '@/common-adapters'
import {HeaderRightActions} from './main/header'
import contactRestricted from '../team-building/contact-restricted.page'
import teamsTeamBuilder from '../team-building/page'

const useHeaderActions = () => {
  const nav = Container.useSafeNavigation()
  const launchNewTeamWizardOrModal = C.useTeamsState(s => s.dispatch.launchNewTeamWizardOrModal)
  return {
    onNewTeam: () => launchNewTeamWizardOrModal(),
    onOpenFolder: () => nav.safeNavigateAppend({props: {}, selected: 'teamsRoot'}),
  }
}

const TeamsScreen = React.lazy(async () => import('./main'))
const teamsRoot = {
  getOptions: C.isMobile
    ? {headerRightActions: () => null, title: 'Teams'}
    : {
        headerRightActions: () => {
          const actions = useHeaderActions()
          return <HeaderRightActions {...actions} />
        },
        headerTitle: () => 'Teams',
        title: 'Teams',
      },
  screen: function TeamsRoot(p: C.ViewPropsToPageProps<typeof TeamsScreen>) {
    return <TeamsScreen {...p.route.params} />
  },
}

const Team = React.lazy(async () => import('./team'))
const team = {
  getOptions: {
    headerHideBorder: true,
    headerShown: C.isMobile,
    presentation: 'modal',
    title: '',
  },
  screen: function TeamScreen(p: C.ViewPropsToPageProps<typeof Team>) {
    return <Team {...p.route.params} />
  },
}

const Channel = React.lazy(async () => import('./channel'))
const teamChannel = {
  getOptions: {
    headerHideBorder: true,
    headerShown: C.isMobile,
    presentation: 'modal',
    title: '',
  },
  screen: function TeamChannel(p: C.ViewPropsToPageProps<typeof Channel>) {
    return (
      <C.Chat.ProviderScreen rp={p}>
        <Channel {...p.route.params} />
      </C.Chat.ProviderScreen>
    )
  },
}

const Ext = React.lazy(async () => import('./external-team'))
const teamExternalTeam = {
  getOptions: {
    headerHideBorder: true,
    headerShown: C.isMobile,
    presentation: 'modal',
    title: '',
  },
  screen: function TeamExternalTeam(p: C.ViewPropsToPageProps<typeof Ext>) {
    return <Ext {...p.route.params} />
  },
}

const TeamMemberIndex = React.lazy(async () => import('./team/member/index.new'))
const teamMember = {
  getOptions: {
    headerShown: false,
  },
  screen: function TeamMember(p: C.ViewPropsToPageProps<typeof TeamMemberIndex>) {
    return <TeamMemberIndex {...p.route.params} />
  },
}

const OpenTeamWarning = React.lazy(async () => import('./team/settings-tab/open-team-warning'))
const openTeamWarning = {screen: OpenTeamWarning}

const RetentionWarning = React.lazy(async () => import('./team/settings-tab/retention/warning'))
const retentionWarning = {screen: RetentionWarning}

const TeamAddEmoji = React.lazy(async () => import('./emojis/add-emoji'))
const teamAddEmoji = {screen: TeamAddEmoji}

const TeamAddEmojiAlias = React.lazy(async () => import('./emojis/add-alias'))
const teamAddEmojiAlias = {screen: TeamAddEmojiAlias}

const TeamAddToChannels = React.lazy(async () => import('./team/member/add-to-channels'))
const teamAddToChannels = {screen: function AddToChannels(p: C.ViewPropsToPageProps<typeof TeamAddToChannels>) {
  return <TeamAddToChannels {...p.route.params} />
}}

const TeamAddToTeamConfirm = React.lazy(async () => import('./add-members-wizard/confirm'))
const teamAddToTeamConfirm = {screen: TeamAddToTeamConfirm}

const TeamAddToTeamContacts = React.lazy(async () => import('./add-members-wizard/add-contacts'))
const teamAddToTeamContacts = {screen: TeamAddToTeamContacts}

const TeamAddToTeamEmail = React.lazy(async () => import('./add-members-wizard/add-email'))
const teamAddToTeamEmail = {screen: TeamAddToTeamEmail}

const TeamAddToTeamFromWhere = React.lazy(async () => import('./add-members-wizard/add-from-where'))
const teamAddToTeamFromWhere = {screen: TeamAddToTeamFromWhere}

const TeamAddToTeamPhone = React.lazy(async () => import('./add-members-wizard/add-phone'))
const teamAddToTeamPhone = {screen: TeamAddToTeamPhone}

const TeamCreateChannels = React.lazy(async () => import('./channel/create-channels'))
const teamCreateChannels = {screen: TeamCreateChannels}

const TeamDeleteChannel = React.lazy(async () => import('./confirm-modals/delete-channel'))
const teamDeleteChannel = {screen: TeamDeleteChannel}

const TeamDeleteTeam = React.lazy(async () => import('./delete-team'))
const teamDeleteTeam = {screen: TeamDeleteTeam}

const TeamEditChannel = React.lazy(async () => import('./team/member/edit-channel'))
const teamEditChannel = {screen: function EditChannel(p: C.ViewPropsToPageProps<typeof TeamEditChannel>) {
  return <TeamEditChannel {...p.route.params} />
}}

const TeamEditTeamDescription = React.lazy(async () => import('./edit-team-description'))
const teamEditTeamDescription = {screen: TeamEditTeamDescription}

const TeamEditTeamInfo = React.lazy(async () => import('./team/team-info'))
const teamEditTeamInfo = {screen: TeamEditTeamInfo}

const TeamInviteByContact = React.lazy(async () => import('./invite-by-contact'))
const teamInviteByContact = {screen: TeamInviteByContact}

const TeamInviteByEmail = React.lazy(async () => import('./invite-by-email'))
const teamInviteByEmail = {screen: TeamInviteByEmail}

const TeamInviteLinkJoin = React.lazy(async () => import('./join-team/join-from-invite'))
const teamInviteLinkJoin = {screen: TeamInviteLinkJoin}

const TeamJoinTeamDialog = React.lazy(async () => import('./join-team'))
const teamJoinTeamDialog = {screen: TeamJoinTeamDialog}

const TeamNewTeamDialog = React.lazy(async () => import('./new-team'))
const teamNewTeamDialog = {screen: TeamNewTeamDialog}

const TeamReallyLeaveTeam = React.lazy(async () => import('./confirm-modals/really-leave-team'))
const teamReallyLeaveTeam = {screen: TeamReallyLeaveTeam}

const TeamReallyRemoveChannelMember = React.lazy(async () => import('./confirm-modals/confirm-remove-from-channel'))
const teamReallyRemoveChannelMember = {screen: TeamReallyRemoveChannelMember}

const TeamReallyRemoveMember = React.lazy(async () => import('./confirm-modals/confirm-kick-out'))
const teamReallyRemoveMember = {screen: TeamReallyRemoveMember}

const TeamRename = React.lazy(async () => import('./rename-team'))
const teamRename = {screen: TeamRename}

const TeamWizard1TeamPurpose = React.lazy(async () => import('./new-team/wizard/team-purpose'))
const teamWizard1TeamPurpose = {screen: TeamWizard1TeamPurpose}

const TeamWizard2TeamInfo = React.lazy(async () => import('./new-team/wizard/new-team-info'))
const teamWizard2TeamInfo = {screen: TeamWizard2TeamInfo}

const TeamWizard4TeamSize = React.lazy(async () => import('./new-team/wizard/make-big-team'))
const teamWizard4TeamSize = {screen: TeamWizard4TeamSize}

const TeamWizard5Channels = React.lazy(async () => import('./new-team/wizard/create-channels'))
const teamWizard5Channels = {screen: TeamWizard5Channels}

const TeamWizard6Subteams = React.lazy(async () => import('./new-team/wizard/create-subteams'))
const teamWizard6Subteams = {screen: TeamWizard6Subteams}

const TeamWizardSubteamMembers = React.lazy(async () => import('./new-team/wizard/add-subteam-members'))
const teamWizardSubteamMembers = {screen: TeamWizardSubteamMembers}

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
  teamInviteByContact,
  teamInviteByEmail,
  teamInviteLinkJoin,
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

export type RootParamListTeams = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
