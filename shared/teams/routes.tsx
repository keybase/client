import * as React from 'react'
import * as C from '@/constants'
import * as Container from '@/util/container'
import {HeaderRightActions} from './main/header'
import contactRestricted from '../team-building/contact-restricted.page'
import teamsTeamBuilder from '../team-building/page'

const useHeaderActions = () => {
  const nav = Container.useSafeNavigation()
  const launchNewTeamWizardOrModal = C.useTeamsState(s => s.dispatch.launchNewTeamWizardOrModal)
  return {
    onCreateTeam: () => launchNewTeamWizardOrModal(),
    onJoinTeam: () => nav.safeNavigateAppend('teamJoinTeamDialog'),
  }
}

const Channel = React.lazy(async () => import('./channel'))

const TeamsScreen = React.lazy(async () => import('./main'))
const teamsRoot = C.makeScreen(TeamsScreen, {
  getOptions: C.isMobile
    ? {headerRightActions: () => null, title: 'Teams'}
    : {
        headerRightActions: function HeaderRight() {
          const actions = useHeaderActions()
          return <HeaderRightActions {...actions} />
        },
        headerTitle: () => 'Teams',
        title: 'Teams',
      },
})

export const newRoutes = {
  team: C.makeScreen(
    React.lazy(async () => import('./team')),
    {getOptions: {headerShown: C.isMobile, presentation: 'modal', title: ''}}
  ),
  teamChannel: C.Chat.makeChatScreen(Channel, {
    getOptions: {headerShadowVisible: false, headerTitle: '', underNotch: true},
  }),
  teamExternalTeam: C.makeScreen(
    React.lazy(async () => import('./external-team')),
    {getOptions: {headerShown: C.isMobile, presentation: 'modal', title: ''}}
  ),
  teamMember: C.makeScreen(
    React.lazy(async () => import('./team/member/index.new')),
    {getOptions: {headerShown: false}}
  ),
  teamsRoot,
}

export const newModalRoutes = {
  contactRestricted,
  openTeamWarning: C.makeScreen(React.lazy(async () => import('./team/settings-tab/open-team-warning'))),
  retentionWarning: C.makeScreen(
    React.lazy(async () => import('./team/settings-tab/retention/warning/container'))
  ),
  teamAddEmoji: C.makeScreen(React.lazy(async () => import('./emojis/add-emoji'))),
  teamAddEmojiAlias: C.Chat.makeChatScreen(React.lazy(async () => import('./emojis/add-alias'))),
  teamAddToChannels: C.makeScreen(React.lazy(async () => import('./team/member/add-to-channels'))),
  teamAddToTeamConfirm: {
    getOptions: {gesturesEnabled: false},
    screen: React.lazy(async () => import('./add-members-wizard/confirm')),
  },
  teamAddToTeamContacts: {screen: React.lazy(async () => import('./add-members-wizard/add-contacts'))},
  teamAddToTeamEmail: C.makeScreen(React.lazy(async () => import('./add-members-wizard/add-email'))),
  teamAddToTeamFromWhere: {screen: React.lazy(async () => import('./add-members-wizard/add-from-where'))},
  teamAddToTeamPhone: {screen: React.lazy(async () => import('./add-members-wizard/add-phone'))},
  teamCreateChannels: C.makeScreen(React.lazy(async () => import('./channel/create-channels'))),
  teamDeleteChannel: C.makeScreen(React.lazy(async () => import('./confirm-modals/delete-channel'))),
  teamDeleteTeam: C.makeScreen(React.lazy(async () => import('./delete-team'))),
  teamEditChannel: C.makeScreen(React.lazy(async () => import('./team/member/edit-channel'))),
  teamEditTeamDescription: C.makeScreen(React.lazy(async () => import('./edit-team-description'))),
  teamEditTeamInfo: C.makeScreen(React.lazy(async () => import('./team/team-info'))),
  teamInviteByContact: C.makeScreen(React.lazy(async () => import('./invite-by-contact/container'))),
  teamInviteByEmail: C.makeScreen(React.lazy(async () => import('./invite-by-email'))),
  teamInviteLinkJoin: {screen: React.lazy(async () => import('./join-team/join-from-invite'))},
  teamJoinTeamDialog: C.makeScreen(React.lazy(async () => import('./join-team/container'))),
  teamNewTeamDialog: C.makeScreen(React.lazy(async () => import('./new-team'))),
  teamReallyLeaveTeam: C.makeScreen(
    React.lazy(async () => import('./confirm-modals/really-leave-team/container'))
  ),
  teamReallyRemoveChannelMember: C.makeScreen(
    React.lazy(async () => import('./confirm-modals/confirm-remove-from-channel'))
  ),
  teamReallyRemoveMember: C.makeScreen(React.lazy(async () => import('./confirm-modals/confirm-kick-out'))),
  teamRename: C.makeScreen(React.lazy(async () => import('./rename-team'))),
  teamWizard1TeamPurpose: {screen: React.lazy(async () => import('./new-team/wizard/team-purpose'))},
  teamWizard2TeamInfo: {screen: React.lazy(async () => import('./new-team/wizard/new-team-info'))},
  teamWizard4TeamSize: {screen: React.lazy(async () => import('./new-team/wizard/make-big-team'))},
  teamWizard5Channels: {screen: React.lazy(async () => import('./new-team/wizard/create-channels'))},
  teamWizard6Subteams: {screen: React.lazy(async () => import('./new-team/wizard/create-subteams'))},
  teamWizardSubteamMembers: {screen: React.lazy(async () => import('./new-team/wizard/add-subteam-members'))},
  teamsTeamBuilder,
}

export type RootParamListTeams = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
