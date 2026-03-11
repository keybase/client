import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as Chat from '@/stores/chat'
import * as T from '@/constants/types'
import * as Teams from '@/stores/teams'
import {ModalTitle} from './common'
import {HeaderLeftButton} from '@/common-adapters/header-buttons'
import contactRestricted from '../team-building/contact-restricted.page'
import teamsTeamBuilder from '../team-building/page'
import teamsRootGetOptions from './get-options'

const WizardEmailHeaderTitle = () => {
  const teamID = Teams.useTeamsState(s => s.addMembersWizard.teamID)
  return <ModalTitle teamID={teamID} title="Email list" />
}

const WizardPhoneHeaderTitle = () => {
  const teamID = Teams.useTeamsState(s => s.addMembersWizard.teamID)
  return <ModalTitle teamID={teamID} title="Phone list" />
}

const TeamInfoHeaderTitle = ({teamID}: {teamID: T.Teams.TeamID}) => {
  const teamname = Teams.useTeamsState(s => Teams.getTeamMeta(s, teamID).teamname)
  const isSubteam = teamname.includes('.')
  return <ModalTitle teamID={teamID} title={isSubteam ? 'Edit subteam info' : 'Edit team info'} />
}

const ConfirmHeaderTitle = () => {
  const {teamID, count} = Teams.useTeamsState(
    C.useShallow(s => ({
      teamID: s.addMembersWizard.teamID,
      count: s.addMembersWizard.addingMembers.length,
    }))
  )
  const noun = count === 1 ? 'person' : 'people'
  return <ModalTitle teamID={teamID} title={`Inviting ${count} ${noun}`} />
}

const ConfirmHeaderLeft = () => {
  const teamID = Teams.useTeamsState(s => s.addMembersWizard.teamID)
  const newTeam = teamID === T.Teams.newTeamWizardTeamID
  const cancelAddMembersWizard = Teams.useTeamsState(s => s.dispatch.cancelAddMembersWizard)
  const navUpToScreen = C.useRouterState(s => s.dispatch.navUpToScreen)
  if (newTeam) {
    return <Kb.Icon type="iconfont-arrow-left" onClick={() => navUpToScreen('teamAddToTeamFromWhere')} />
  }
  return (
    <Kb.Text type="BodyBigLink" onClick={cancelAddMembersWizard}>
      Cancel
    </Kb.Text>
  )
}

const AddFromWhereHeaderLeft = () => {
  const teamID = Teams.useTeamsState(s => s.addMembersWizard.teamID)
  const newTeam = teamID === T.Teams.newTeamWizardTeamID
  const cancelAddMembersWizard = Teams.useTeamsState(s => s.dispatch.cancelAddMembersWizard)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  if (newTeam) {
    return <Kb.Icon type="iconfont-arrow-left" onClick={navigateUp} />
  }
  return <Kb.Text type="BodyBigLink" onClick={cancelAddMembersWizard}>Cancel</Kb.Text>
}

const AddFromWhereSkip = () => {
  const finishNewTeamWizard = Teams.useTeamsState(s => s.dispatch.finishNewTeamWizard)
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyTeamsCreation)
  if (Kb.Styles.isMobile) {
    return waiting ? (
      <Kb.ProgressIndicator />
    ) : (
      <Kb.Text type="BodyBigLink" onClick={finishNewTeamWizard}>Skip</Kb.Text>
    )
  }
  return <Kb.Button mode="Secondary" label="Skip" small={true} onClick={finishNewTeamWizard} waiting={waiting} />
}

const AddFromWhereHeaderRight = () => {
  const teamID = Teams.useTeamsState(s => s.addMembersWizard.teamID)
  const newTeam = teamID === T.Teams.newTeamWizardTeamID
  return newTeam ? <AddFromWhereSkip /> : null
}

const AddFromWhereHeaderTitle = () => {
  const teamID = Teams.useTeamsState(s => s.addMembersWizard.teamID)
  return <ModalTitle title={Kb.Styles.isMobile ? 'Add/Invite people' : 'Add or invite people'} teamID={teamID} />
}

export const newRoutes = {
  team: C.makeScreen(
    React.lazy(async () => import('./team')),
    {getOptions: {headerShadowVisible: false, headerTitle: ''}}
  ),
  teamChannel: Chat.makeChatScreen(
    React.lazy(async () => import('./channel')),
    {getOptions: {headerShadowVisible: false, headerTitle: ''}}
  ),
  teamExternalTeam: C.makeScreen(
    React.lazy(async () => import('./external-team')),
    {
      getOptions: {
        header: undefined,
        headerBottomStyle: {height: undefined},
        headerShadowVisible: false,
        title: ' ', // hack: trick router shim so it doesn't add a safe area around us
      },
    }
  ),
  teamMember: C.makeScreen(
    React.lazy(async () => import('./team/member/index.new')),
    {getOptions: {headerShadowVisible: false, headerTitle: ''}}
  ),
  teamsRoot: {
    getOptions: teamsRootGetOptions,
    screen: React.lazy(async () => import('./container')),
  },
}

export const newModalRoutes = {
  contactRestricted,
  openTeamWarning: C.makeScreen(React.lazy(async () => import('./team/settings-tab/open-team-warning'))),
  retentionWarning: C.makeScreen(React.lazy(async () => import('./team/settings-tab/retention/warning'))),
  teamAddEmoji: C.makeScreen(React.lazy(async () => import('./emojis/add-emoji')), {
    getOptions: {title: 'Add emoji'},
  }),
  teamAddEmojiAlias: Chat.makeChatScreen(React.lazy(async () => import('./emojis/add-alias')), {
    getOptions: {title: 'Add an alias'},
  }),
  teamAddToChannels: C.makeScreen(React.lazy(async () => import('./team/member/add-to-channels')), {
    getOptions: ({route}) => ({
      headerTitle: () => <ModalTitle teamID={route.params.teamID} title="Browse all channels" />,
    }),
  }),
  teamAddToTeamConfirm: C.makeScreen(React.lazy(async () => import('./add-members-wizard/confirm')), {
    getOptions: {
      gestureEnabled: false,
      headerLeft: () => <ConfirmHeaderLeft />,
      headerTitle: () => <ConfirmHeaderTitle />,
      modalStyle: {height: 560},
    },
  }),
  teamAddToTeamContacts: C.makeScreen(React.lazy(async () => import('./add-members-wizard/add-contacts')), {
    getOptions: {headerLeft: HeaderLeftButton, modalStyle: {height: 560}},
  }),
  teamAddToTeamEmail: C.makeScreen(React.lazy(async () => import('./add-members-wizard/add-email')), {
    getOptions: {headerLeft: HeaderLeftButton, headerTitle: () => <WizardEmailHeaderTitle />, modalStyle: {height: 560}},
  }),
  teamAddToTeamFromWhere: C.makeScreen(React.lazy(async () => import('./add-members-wizard/add-from-where')), {
    getOptions: {
      headerLeft: () => <AddFromWhereHeaderLeft />,
      headerRight: () => <AddFromWhereHeaderRight />,
      headerTitle: () => <AddFromWhereHeaderTitle />,
      modalStyle: {height: 560},
    },
  }),
  teamAddToTeamPhone: C.makeScreen(React.lazy(async () => import('./add-members-wizard/add-phone')), {
    getOptions: {headerLeft: HeaderLeftButton, headerTitle: () => <WizardPhoneHeaderTitle />, modalStyle: {height: 560}},
  }),
  teamCreateChannels: C.makeScreen(React.lazy(async () => import('./channel/create-channels')), {
    getOptions: ({route}) => ({
      headerLeft: HeaderLeftButton,
      headerTitle: () => <ModalTitle teamID={route.params.teamID} title="Create channels" />,
    }),
  }),
  teamDeleteChannel: C.makeScreen(React.lazy(async () => import('./confirm-modals/delete-channel'))),
  teamDeleteTeam: C.makeScreen(React.lazy(async () => import('./delete-team'))),
  teamEditChannel: C.makeScreen(React.lazy(async () => import('./team/member/edit-channel')), {
    getOptions: ({route}) => ({
      headerLeft: HeaderLeftButton,
      headerTitle: () => <ModalTitle teamID={route.params.teamID} title={`#${route.params.channelname}`} />,
    }),
  }),
  teamEditTeamDescription: C.makeScreen(React.lazy(async () => import('./edit-team-description')), {
    getOptions: ({route}) => ({
      headerTitle: () => <ModalTitle teamID={route.params.teamID} title="Edit team description" />,
    }),
  }),
  teamEditTeamInfo: C.makeScreen(React.lazy(async () => import('./team/team-info')), {
    getOptions: ({route}) => ({
      headerLeft: HeaderLeftButton,
      headerTitle: () => <TeamInfoHeaderTitle teamID={route.params.teamID} />,
    }),
  }),
  teamInviteByContact: C.makeScreen(React.lazy(async () => import('./invite-by-contact/container')), {
    getOptions: {title: 'Invite contacts'},
  }),
  teamInviteByEmail: C.makeScreen(React.lazy(async () => import('./invite-by-email'))),
  teamInviteLinkJoin: C.makeScreen(React.lazy(async () => import('./join-team/join-from-invite'))),
  teamJoinTeamDialog: C.makeScreen(React.lazy(async () => import('./join-team/container')), {
    getOptions: {title: 'Join a team'},
  }),
  teamNewTeamDialog: C.makeScreen(React.lazy(async () => import('./new-team')), {
    getOptions: {title: 'Create a team'},
  }),
  teamReallyLeaveTeam: C.makeScreen(React.lazy(async () => import('./confirm-modals/really-leave-team'))),
  teamReallyRemoveChannelMember: C.makeScreen(
    React.lazy(async () => import('./confirm-modals/confirm-remove-from-channel'))
  ),
  teamReallyRemoveMember: C.makeScreen(React.lazy(async () => import('./confirm-modals/confirm-kick-out'))),
  teamRename: C.makeScreen(React.lazy(async () => import('./rename-team')), {
    getOptions: {modalStyle: {height: 480, width: 560}, title: 'Rename subteam'},
  }),
  teamWizard1TeamPurpose: C.makeScreen(React.lazy(async () => import('./new-team/wizard/team-purpose')), {
    getOptions: {headerTitle: () => <ModalTitle teamID={T.Teams.noTeamID} title="New team" />},
  }),
  teamWizard2TeamInfo: C.makeScreen(React.lazy(async () => import('./new-team/wizard/new-team-info'))),
  teamWizard4TeamSize: C.makeScreen(React.lazy(async () => import('./new-team/wizard/make-big-team')), {
    getOptions: {
      headerLeft: HeaderLeftButton,
      headerTitle: () => <ModalTitle teamID={T.Teams.newTeamWizardTeamID} title="Make it a big team?" />,
    },
  }),
  teamWizard5Channels: C.makeScreen(React.lazy(async () => import('./new-team/wizard/create-channels')), {
    getOptions: {
      headerLeft: HeaderLeftButton,
      headerTitle: () => <ModalTitle teamID={T.Teams.newTeamWizardTeamID} title="Create channels" />,
    },
  }),
  teamWizard6Subteams: C.makeScreen(React.lazy(async () => import('./new-team/wizard/create-subteams')), {
    getOptions: {
      headerLeft: HeaderLeftButton,
      headerTitle: () => <ModalTitle teamID={T.Teams.newTeamWizardTeamID} title="Create subteams" />,
    },
  }),
  teamWizardSubteamMembers: C.makeScreen(React.lazy(async () => import('./new-team/wizard/add-subteam-members')), {
    getOptions: {
      headerLeft: HeaderLeftButton,
      headerTitle: () => <ModalTitle teamID={T.Teams.newTeamWizardTeamID} title="Add members" />,
    },
  }),
  teamsTeamBuilder,
}
