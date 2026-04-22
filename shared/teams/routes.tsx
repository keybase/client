import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {makeChatScreen} from '@/chat/make-chat-screen'
import * as T from '@/constants/types'
import * as Teams from '@/stores/teams'
import * as TB from '@/stores/team-building'
import {addMembersToWizard, makeAddMembersWizard, type AddMembersWizard} from './add-members-wizard/state'
import {ModalTitle} from './common'
import {HeaderLeftButton} from '@/common-adapters/header-buttons'
import contactRestricted from '../team-building/contact-restricted.page'
import teamsTeamBuilder from '../team-building/page'
import {TeamBuilderScreen} from '../team-building/page'
import {useModalHeaderState} from '@/stores/modal-header'
import teamsRootGetOptions from './get-options'
import {defineRouteMap} from '@/constants/types/router'
import {createNewTeamFromWizard, type NewTeamWizard} from './new-team/wizard/state'
import {RPCError} from '@/util/errors'

const TeamsTeamBuilderScreen = (p: Parameters<typeof TeamBuilderScreen>[0]) => (
  <TeamBuilderScreen
    {...p}
    onComplete={users => {
      const currentWizard = p.route.params.addMembersWizard ?? makeAddMembersWizard(p.route.params.teamID ?? T.Teams.noTeamID)
      const f = async () => {
        try {
          const wizard = await addMembersToWizard(
            currentWizard,
            [...users].map(user => ({assertion: user.id, role: 'writer'} as const))
          )
          C.Router2.navUpToScreen({name: 'teamAddToTeamConfirm', params: {wizard}}, true)
        } catch (err) {
          TB.getTBStore('teams').dispatch.setError(err instanceof Error ? err.message : String(err))
          C.Router2.navigateAppend({name: 'teamsTeamBuilder', params: p.route.params})
        }
      }
      C.ignorePromise(f())
    }}
  />
)

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

const AddContactsHeaderTitle = ({wizard}: {wizard: AddMembersWizard}) => (
  <ModalTitle teamID={wizard.teamID} title="Add members" newTeamWizard={wizard.newTeamWizard} />
)

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

const WizardEmailHeaderTitle = ({wizard}: {wizard: AddMembersWizard}) => (
  <ModalTitle teamID={wizard.teamID} title="Email list" newTeamWizard={wizard.newTeamWizard} />
)

const WizardPhoneHeaderTitle = ({wizard}: {wizard: AddMembersWizard}) => (
  <ModalTitle teamID={wizard.teamID} title="Phone list" newTeamWizard={wizard.newTeamWizard} />
)

const TeamInfoHeaderTitle = ({teamID}: {teamID: T.Teams.TeamID}) => {
  const teamname = Teams.useTeamsState(s => Teams.getTeamMeta(s, teamID).teamname)
  const isSubteam = teamname.includes('.')
  return <ModalTitle teamID={teamID} title={isSubteam ? 'Edit subteam info' : 'Edit team info'} />
}

const ConfirmHeaderTitle = ({wizard}: {wizard: AddMembersWizard}) => {
  const count = wizard.addingMembers.length
  const noun = count === 1 ? 'person' : 'people'
  return <ModalTitle teamID={wizard.teamID} title={`Inviting ${count} ${noun}`} newTeamWizard={wizard.newTeamWizard} />
}

const ConfirmHeaderLeft = ({wizard}: {wizard: AddMembersWizard}) => {
  const newTeam = wizard.teamID === T.Teams.newTeamWizardTeamID
  const clearModals = C.Router2.clearModals
  if (newTeam) {
    return (
      <Kb.Icon
        type="iconfont-arrow-left"
        onClick={() => C.Router2.navUpToScreen({name: 'teamAddToTeamFromWhere', params: {wizard}}, true)}
      />
    )
  }
  return (
    <Kb.Text type="BodyBigLink" onClick={clearModals}>
      Cancel
    </Kb.Text>
  )
}

const AddFromWhereHeaderLeft = ({wizard}: {wizard: AddMembersWizard}) => {
  const newTeam = wizard.teamID === T.Teams.newTeamWizardTeamID
  const clearModals = C.Router2.clearModals
  const navigateUp = C.Router2.navigateUp
  if (newTeam) {
    return <Kb.Icon type="iconfont-arrow-left" onClick={navigateUp} />
  }
  return <Kb.Text type="BodyBigLink" onClick={clearModals}>Cancel</Kb.Text>
}

const AddFromWhereSkip = ({wizard}: {wizard: AddMembersWizard}) => {
  const clearModals = C.Router2.clearModals
  const navigateAppend = C.Router2.navigateAppend
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyTeamsCreation)
  const onSkip = () => {
    const newTeamWizard = wizard.newTeamWizard
    if (!newTeamWizard) {
      return
    }
    const cleanWizard: AddMembersWizard = {
      ...wizard,
      newTeamWizard: {...newTeamWizard, error: undefined},
    }
    navigateAppend({name: 'teamAddToTeamFromWhere', params: {wizard: cleanWizard}}, true)
    const f = async () => {
      try {
        const teamID = await createNewTeamFromWizard(newTeamWizard, cleanWizard.addingMembers)
        navigateAppend({name: 'team', params: {teamID}})
        clearModals()
      } catch (err) {
        const errorMessage = err instanceof RPCError ? err.desc : String(err)
        const erroredWizard: AddMembersWizard = {
          ...wizard,
          newTeamWizard: {...newTeamWizard, error: errorMessage},
        }
        navigateAppend(
          {
            name: 'teamAddToTeamFromWhere',
            params: {wizard: erroredWizard},
          },
          true
        )
      }
    }
    C.ignorePromise(f())
  }
  if (Kb.Styles.isMobile) {
    return waiting ? (
      <Kb.ProgressIndicator />
    ) : (
      <Kb.Text type="BodyBigLink" onClick={onSkip}>Skip</Kb.Text>
    )
  }
  return (
    <Kb.Button
      mode="Secondary"
      label="Skip"
      small={true}
      onClick={onSkip}
      waiting={waiting}
    />
  )
}

const AddFromWhereHeaderRight = ({wizard}: {wizard: AddMembersWizard}) => {
  return wizard.teamID === T.Teams.newTeamWizardTeamID ? <AddFromWhereSkip wizard={wizard} /> : null
}

const AddFromWhereHeaderTitle = ({wizard}: {wizard: AddMembersWizard}) => (
  <ModalTitle
    title={Kb.Styles.isMobile ? 'Add/Invite people' : 'Add or invite people'}
    teamID={wizard.teamID}
    newTeamWizard={wizard.newTeamWizard}
  />
)

const JoinTeamHeaderTitle = ({success}: {success?: boolean}) => <>{success ? 'Request sent' : 'Join a team'}</>

const JoinTeamHeaderLeft = ({success}: {success?: boolean}) => (success ? null : <HeaderLeftButton />)

const NewTeamInfoHeaderTitle = ({wizard}: {wizard: NewTeamWizard}) => {
  const title = wizard.teamType === 'subteam' ? 'Create a subteam' : 'Enter team info'
  const teamID = wizard.parentTeamID ?? T.Teams.newTeamWizardTeamID
  return <ModalTitle teamID={teamID} title={title} newTeamWizard={wizard} />
}

const NewTeamInfoHeaderLeft = ({wizard}: {wizard: NewTeamWizard}) => {
  const isSubteam = wizard.teamType === 'subteam'
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

export const newRoutes = defineRouteMap({
  team: C.makeScreen(
    React.lazy(async () => import('./team')),
    {getOptions: {headerShadowVisible: false, headerTitle: ''}}
  ),
  teamChannel: makeChatScreen(
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
    ...C.makeScreen(React.lazy(async () => import('./container')), {
      getOptions: teamsRootGetOptions,
    }),
    initialParams: {},
  },
})

export const newModalRoutes = defineRouteMap({
  contactRestricted,
  openTeamWarning: C.makeScreen(React.lazy(async () => import('./team/settings-tab/open-team-warning'))),
  retentionWarning: C.makeScreen(React.lazy(async () => import('./team/settings-tab/retention/warning'))),
  teamAddEmoji: C.makeScreen(React.lazy(async () => import('./emojis/add-emoji')), {
    getOptions: {headerLeft: Kb.Styles.isMobile ? () => <HeaderLeftButton mode="cancel" /> : undefined, title: 'Add emoji'},
  }),
  teamAddEmojiAlias: makeChatScreen(React.lazy(async () => import('./emojis/add-alias')), {
    getOptions: {headerLeft: Kb.Styles.isMobile ? () => <HeaderLeftButton mode="cancel" /> : undefined, title: 'Add an alias'},
  }),
  teamAddToChannels: C.makeScreen(React.lazy(async () => import('./team/member/add-to-channels')), {
    getOptions: ({route}) => ({
      headerRight: () => <AddToChannelsHeaderRight />,
      headerTitle: () => <AddToChannelsHeaderTitle teamID={route.params.teamID} />,
    }),
  }),
  teamAddToTeamConfirm: C.makeScreen(React.lazy(async () => import('./add-members-wizard/confirm')), {
    getOptions: ({route}) => ({
      gestureEnabled: false,
      headerLeft: () => <ConfirmHeaderLeft wizard={route.params.wizard} />,
      headerTitle: () => <ConfirmHeaderTitle wizard={route.params.wizard} />,
      modalStyle: {height: 560},
    }),
  }),
  teamAddToTeamContacts: C.makeScreen(React.lazy(async () => import('./add-members-wizard/add-contacts')), {
    getOptions: ({route}) => ({
      headerLeft: HeaderLeftButton,
      headerRight: () => <AddContactsHeaderRight />,
      headerTitle: () => <AddContactsHeaderTitle wizard={route.params.wizard} />,
      modalStyle: {height: 560},
    }),
  }),
  teamAddToTeamEmail: C.makeScreen(React.lazy(async () => import('./add-members-wizard/add-email')), {
    getOptions: ({route}) => ({
      headerLeft: HeaderLeftButton,
      headerTitle: () => <WizardEmailHeaderTitle wizard={route.params.wizard} />,
      modalStyle: {height: 560},
    }),
  }),
  teamAddToTeamFromWhere: C.makeScreen(React.lazy(async () => import('./add-members-wizard/add-from-where')), {
    getOptions: ({route}) => ({
      headerLeft: () => <AddFromWhereHeaderLeft wizard={route.params.wizard} />,
      headerRight: () => <AddFromWhereHeaderRight wizard={route.params.wizard} />,
      headerTitle: () => <AddFromWhereHeaderTitle wizard={route.params.wizard} />,
      modalStyle: {height: 560},
    }),
  }),
  teamAddToTeamPhone: C.makeScreen(React.lazy(async () => import('./add-members-wizard/add-phone')), {
    getOptions: ({route}) => ({
      headerLeft: HeaderLeftButton,
      headerTitle: () => <WizardPhoneHeaderTitle wizard={route.params.wizard} />,
      modalStyle: {height: 560},
    }),
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
    getOptions: ({route}) => ({
      headerLeft: () => <JoinTeamHeaderLeft success={route.params.success} />,
      headerTitle: () => <JoinTeamHeaderTitle success={route.params.success} />,
    }),
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
    getOptions: ({route}) => ({
      headerTitle: () => <ModalTitle teamID={T.Teams.noTeamID} title="New team" newTeamWizard={route.params.wizard} />,
    }),
  }),
  teamWizard2TeamInfo: C.makeScreen(React.lazy(async () => import('./new-team/wizard/new-team-info')), {
    getOptions: ({route}) => ({
      headerLeft: () => <NewTeamInfoHeaderLeft wizard={route.params.wizard} />,
      headerTitle: () => <NewTeamInfoHeaderTitle wizard={route.params.wizard} />,
    }),
  }),
  teamWizard4TeamSize: C.makeScreen(React.lazy(async () => import('./new-team/wizard/make-big-team')), {
    getOptions: ({route}) => ({
      headerLeft: HeaderLeftButton,
      headerTitle: () => (
        <ModalTitle teamID={T.Teams.newTeamWizardTeamID} title="Make it a big team?" newTeamWizard={route.params.wizard} />
      ),
    }),
  }),
  teamWizard5Channels: C.makeScreen(React.lazy(async () => import('./new-team/wizard/create-channels')), {
    getOptions: ({route}) => ({
      headerLeft: HeaderLeftButton,
      headerTitle: () => (
        <ModalTitle teamID={T.Teams.newTeamWizardTeamID} title="Create channels" newTeamWizard={route.params.wizard} />
      ),
    }),
  }),
  teamWizard6Subteams: C.makeScreen(React.lazy(async () => import('./new-team/wizard/create-subteams')), {
    getOptions: ({route}) => ({
      headerLeft: HeaderLeftButton,
      headerTitle: () => (
        <ModalTitle teamID={T.Teams.newTeamWizardTeamID} title="Create subteams" newTeamWizard={route.params.wizard} />
      ),
    }),
  }),
  teamWizardSubteamMembers: C.makeScreen(React.lazy(async () => import('./new-team/wizard/add-subteam-members')), {
    getOptions: ({route}) => ({
      headerLeft: HeaderLeftButton,
      headerRight: () => <SubteamMembersHeaderRight />,
      headerTitle: () => <ModalTitle teamID={T.Teams.newTeamWizardTeamID} title="Add members" newTeamWizard={route.params.wizard} />,
    }),
  }),
  teamsTeamBuilder: {
    ...teamsTeamBuilder,
    screen: TeamsTeamBuilderScreen,
  },
})
