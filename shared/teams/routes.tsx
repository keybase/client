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
import {useModalHeaderState} from '@/stores/modal-header'
import teamsRootGetOptions from './get-options'

const AddToChannelsHeaderTitle = ({teamID}: {teamID: T.Teams.TeamID}) => {
  const title = useModalHeaderState(s => s.title)
  return <ModalTitle teamID={teamID} title={title || 'Browse all channels'} />
}

const AddToChannelsHeaderRight = () => {
  const {enabled, waiting, onAction} = useModalHeaderState(
    C.useShallow(s => ({enabled: s.actionEnabled, onAction: s.onAction, waiting: s.actionWaiting}))
  )
  if (!onAction) return null
  if (waiting) return <Kb.ProgressIndicator type="Large" />
  return (
    <Kb.Text
      type="BodyBigLink"
      onClick={onAction}
      style={!enabled ? {opacity: 0.4} : undefined}
    >
      Add
    </Kb.Text>
  )
}

const SubteamMembersHeaderRight = () => {
  const {onAction, title} = useModalHeaderState(
    C.useShallow(s => ({onAction: s.onAction, title: s.title}))
  )
  if (!Kb.Styles.isMobile) return null
  return (
    <Kb.Box2 direction="horizontal" style={{width: 48}} justifyContent="flex-end">
      <Kb.Text type="BodyBigLink" onClick={onAction}>
        {title || 'Skip'}
      </Kb.Text>
    </Kb.Box2>
  )
}

const AddContactsHeaderTitle = () => {
  const teamID = Teams.useTeamsState(s => s.addMembersWizard.teamID)
  return <ModalTitle teamID={teamID} title="Add members" />
}

const AddContactsHeaderRight = () => {
  const {enabled, waiting, onAction} = useModalHeaderState(
    C.useShallow(s => ({enabled: s.actionEnabled, onAction: s.onAction, waiting: s.actionWaiting}))
  )
  return (
    <Kb.Box2 direction="horizontal" style={Kb.Styles.globalStyles.positionRelative}>
      <Kb.Text
        type="BodyBigLink"
        onClick={!waiting && enabled ? onAction : undefined}
        style={!enabled ? {opacity: 0} : waiting ? {opacity: 0.4} : undefined}
      >
        Done
      </Kb.Text>
      {waiting && (
        <Kb.Box2
          direction="horizontal"
          centerChildren={true}
          style={Kb.Styles.globalStyles.fillAbsolute}
        >
          <Kb.ProgressIndicator />
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
}

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
  const {count, teamID} = Teams.useTeamsState(
    C.useShallow(s => ({
      count: s.addMembersWizard.addingMembers.length,
      teamID: s.addMembersWizard.teamID,
    }))
  )
  const noun = count === 1 ? 'person' : 'people'
  return <ModalTitle teamID={teamID} title={`Inviting ${count} ${noun}`} />
}

const ConfirmHeaderLeft = () => {
  const teamID = Teams.useTeamsState(s => s.addMembersWizard.teamID)
  const newTeam = teamID === T.Teams.newTeamWizardTeamID
  const cancelAddMembersWizard = Teams.useTeamsState(s => s.dispatch.cancelAddMembersWizard)
  const navUpToScreen = C.Router2.navUpToScreen
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
  const navigateUp = C.Router2.navigateUp
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

const JoinTeamHeaderTitle = () => {
  const success = Teams.useTeamsState(s => s.teamJoinSuccess)
  return <>{success ? 'Request sent' : 'Join a team'}</>
}

const JoinTeamHeaderLeft = () => {
  const success = Teams.useTeamsState(s => s.teamJoinSuccess)
  if (success) return null
  return <HeaderLeftButton />
}

const NewTeamInfoHeaderTitle = () => {
  const {teamType, parentTeamID} = Teams.useTeamsState(
    C.useShallow(s => ({
      parentTeamID: s.newTeamWizard.parentTeamID,
      teamType: s.newTeamWizard.teamType,
    }))
  )
  const title = teamType === 'subteam' ? 'Create a subteam' : 'Enter team info'
  const teamID = parentTeamID ?? T.Teams.newTeamWizardTeamID
  return <ModalTitle teamID={teamID} title={title} />
}

const NewTeamInfoHeaderLeft = () => {
  const isSubteam = Teams.useTeamsState(s => s.newTeamWizard.teamType === 'subteam')
  const clearModals = C.Router2.clearModals
  const navigateUp = C.Router2.navigateUp
  if (isSubteam) {
    return (
      <Kb.Text type="BodyBigLink" onClick={clearModals}>
        Cancel
      </Kb.Text>
    )
  }
  return <Kb.Icon type="iconfont-arrow-left" onClick={navigateUp} />
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
    getOptions: {headerLeft: Kb.Styles.isMobile ? () => <HeaderLeftButton mode="cancel" /> : undefined, title: 'Add emoji'},
  }),
  teamAddEmojiAlias: Chat.makeChatScreen(React.lazy(async () => import('./emojis/add-alias')), {
    getOptions: {headerLeft: Kb.Styles.isMobile ? () => <HeaderLeftButton mode="cancel" /> : undefined, title: 'Add an alias'},
  }),
  teamAddToChannels: C.makeScreen(React.lazy(async () => import('./team/member/add-to-channels')), {
    getOptions: ({route}) => ({
      headerRight: () => <AddToChannelsHeaderRight />,
      headerTitle: () => <AddToChannelsHeaderTitle teamID={route.params.teamID} />,
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
    getOptions: {
      headerLeft: HeaderLeftButton,
      headerRight: () => <AddContactsHeaderRight />,
      headerTitle: () => <AddContactsHeaderTitle />,
      modalStyle: {height: 560},
    },
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
    getOptions: {
      headerLeft: () => <JoinTeamHeaderLeft />,
      headerTitle: () => <JoinTeamHeaderTitle />,
    },
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
  teamWizard2TeamInfo: C.makeScreen(React.lazy(async () => import('./new-team/wizard/new-team-info')), {
    getOptions: {
      headerLeft: () => <NewTeamInfoHeaderLeft />,
      headerTitle: () => <NewTeamInfoHeaderTitle />,
    },
  }),
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
      headerRight: () => <SubteamMembersHeaderRight />,
      headerTitle: () => <ModalTitle teamID={T.Teams.newTeamWizardTeamID} title="Add members" />,
    },
  }),
  teamsTeamBuilder,
}
