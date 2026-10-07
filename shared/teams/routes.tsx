import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {makeChatScreen} from '@/chat/make-chat-screen'
import * as T from '@/constants/types'
import {addMembersToWizard, makeAddMembersWizard, type AddMembersWizard} from './add-members-wizard/state'
import {ModalTitle} from './common'
import {HeaderLeftButton, type HeaderBackButtonProps} from '@/common-adapters/header-buttons'
import contactRestricted from '../team-building/contact-restricted.page'
import teamsTeamBuilder from '../team-building/page'
import {TeamBuilderScreen} from '../team-building/page'
import {useModalHeaderState} from '@/stores/modal-header'
import teamsRootGetOptions from './get-options'
import {defineRouteMap} from '@/constants/types/router'
import {createNewTeamFromWizard, type NewTeamWizard} from './new-team/wizard/state'
import {invalidateLoadedTeams} from './use-teams-list'
import {RPCError} from '@/util/errors'
import {useLoadedTeam} from './team/use-loaded-team'

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
          C.Router2.navigateAppend(
            {
              name: 'teamsTeamBuilder',
              params: {...p.route.params, initialError: err instanceof Error ? err.message : String(err)},
            },
            true
          )
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
  if (!isMobile) return null
  return (
    <Kb.Box2 alignSelf="center" direction="horizontal" style={{width: 48}} justifyContent="flex-end">
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
    <Kb.Box2 alignSelf="center" direction="horizontal" style={Kb.Styles.globalStyles.positionRelative}>
      <Kb.Text
        type="BodyBigLink"
        onClick={!waiting && enabled ? onAction : undefined}
        style={!enabled ? {opacity: 0} : waiting ? {opacity: 0.4} : undefined}
      >
        Done
      </Kb.Text>
      <Kb.LoadingOverlay show={waiting} />
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
  const {
    teamMeta: {teamname},
  } = useLoadedTeam(teamID)
  const isSubteam = teamname.includes('.')
  return <ModalTitle teamID={teamID} title={isSubteam ? 'Edit subteam info' : 'Edit team info'} />
}

const ConfirmHeaderTitle = ({wizard}: {wizard: AddMembersWizard}) => {
  const count = wizard.addingMembers.length
  const noun = count === 1 ? 'person' : 'people'
  return <ModalTitle teamID={wizard.teamID} title={`Inviting ${count} ${noun}`} newTeamWizard={wizard.newTeamWizard} />
}

// Android only: desktop closes with the X, iOS uses a native Cancel item
const ClearModalsCancel = () => (
  <Kb.Text type="BodyBigLink" onClick={C.Router2.clearModals}>
    Cancel
  </Kb.Text>
)

// desktop: a Back only while a wizard step is under it; leaving the flow is the X
const ConfirmHeaderLeft = (p: HeaderBackButtonProps & {wizard: AddMembersWizard}) => {
  const {wizard, ...rest} = p
  if (wizard.teamID === T.Teams.newTeamWizardTeamID) {
    return (
      <HeaderLeftButton
        {...rest}
        onPress={() => C.Router2.navUpToScreen({name: 'teamAddToTeamFromWhere', params: {wizard}}, true)}
      />
    )
  }
  return isMobile ? <ClearModalsCancel /> : null
}

const AddFromWhereHeaderLeft = (p: HeaderBackButtonProps & {wizard: AddMembersWizard}) => {
  const {wizard, ...rest} = p
  if (wizard.teamID === T.Teams.newTeamWizardTeamID) {
    return <HeaderLeftButton {...rest} />
  }
  return isMobile ? <ClearModalsCancel /> : null
}

const AddFromWhereSkip = ({wizard}: {wizard: AddMembersWizard}) => {
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
    C.Router2.navigateAppend({name: 'teamAddToTeamFromWhere', params: {wizard: cleanWizard}}, true)
    const f = async () => {
      try {
        const teamID = await createNewTeamFromWizard(newTeamWizard, cleanWizard.addingMembers)
        invalidateLoadedTeams()
        C.Router2.navigateAppend({name: 'team', params: {teamID}})
        C.Router2.clearModals()
      } catch (err) {
        const errorMessage = err instanceof RPCError ? err.desc : String(err)
        const erroredWizard: AddMembersWizard = {
          ...wizard,
          newTeamWizard: {...newTeamWizard, error: errorMessage},
        }
        C.Router2.navigateAppend(
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
  if (isMobile) {
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

const AddFromWhereHeaderTitle = ({wizard}: {wizard: AddMembersWizard}) => (
  <ModalTitle
    title={isMobile ? 'Add/Invite people' : 'Add or invite people'}
    teamID={wizard.teamID}
    newTeamWizard={wizard.newTeamWizard}
  />
)

const JoinTeamHeaderTitle = ({success}: {success?: boolean}) => (
  <Kb.Text type={isMobile ? 'BodyBig' : 'Header'} lineClamp={1} center={true}>
    {success ? 'Request sent' : 'Join a team'}
  </Kb.Text>
)

const JoinTeamHeaderLeft = ({success}: {success?: boolean}) => (success ? null : <HeaderLeftButton />)

const NewTeamInfoHeaderTitle = ({wizard}: {wizard: NewTeamWizard}) => {
  const title = wizard.teamType === 'subteam' ? 'Create a subteam' : 'Enter team info'
  const teamID = wizard.parentTeamID ?? T.Teams.newTeamWizardTeamID
  return <ModalTitle teamID={teamID} title={title} newTeamWizard={wizard} />
}

const NewTeamInfoHeaderLeft = (p: HeaderBackButtonProps & {wizard: NewTeamWizard}) => {
  const {wizard, ...rest} = p
  if (wizard.teamType === 'subteam') {
    return isMobile ? <ClearModalsCancel /> : null
  }
  return <HeaderLeftButton {...rest} />
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
        title: '',
      },
    }
  ),
  teamMember: C.makeScreen(
    React.lazy(async () => import('./team/member')),
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
  openTeamWarning: C.makeScreen(React.lazy(async () => import('./team/settings-tab/open-team-warning')), {
    getOptions: ({route}) => ({
      headerTitle: () => (
        <Kb.ModalHeaderTitle
          title={route.params.isOpenTeam ? 'Make team open?' : 'Make team private?'}
          subtitle={route.params.teamname}
        />
      ),
    }),
  }),
  retentionWarning: C.makeScreen(React.lazy(async () => import('./team/settings-tab/retention/warning')), {
    getOptions: ({route}) => ({
      title: route.params.policy.type === 'explode' ? 'Explode messages?' : 'Auto-delete messages?',
    }),
  }),
  teamAddEmoji: C.makeScreen(React.lazy(async () => import('./emojis/add-emoji')), {
    getOptions: {modalSize: 'medium', title: 'Add emoji'},
  }),
  teamAddEmojiAlias: makeChatScreen(React.lazy(async () => import('./emojis/add-alias')), {
    getOptions: {title: 'Add an alias'},
  }),
  teamAddToChannels: C.makeScreen(React.lazy(async () => import('./team/member/add-to-channels')), {
    getOptions: ({route}) => ({
      // iOS: the screen drives unstable_headerRightItems via useModalHeaderAction
      ...(isIOS
        ? {}
        : {headerRight: route.params.usernames ? () => <AddToChannelsHeaderRight /> : undefined}),
      headerTitle: () => <AddToChannelsHeaderTitle teamID={route.params.teamID} />,
      modalSize: 'medium',
    }),
  }),
  teamAddToTeamConfirm: C.makeScreen(React.lazy(async () => import('./add-members-wizard/confirm')), {
    getOptions: ({route}) => ({
      gestureEnabled: false,
      ...(isIOS
        ? {
            unstable_headerLeftItems: () =>
              route.params.wizard.teamID === T.Teams.newTeamWizardTeamID
                ? [
                    Kb.nativeBackHeaderItem(() =>
                      C.Router2.navUpToScreen(
                        {name: 'teamAddToTeamFromWhere', params: {wizard: route.params.wizard}},
                        true
                      )
                    ),
                  ]
                : [Kb.nativeCancelHeaderItem(C.Router2.clearModals)],
          }
        : {headerLeft: (p: HeaderBackButtonProps) => <ConfirmHeaderLeft {...p} wizard={route.params.wizard} />}),
      headerTitle: () => <ConfirmHeaderTitle wizard={route.params.wizard} />,
      modalSize: 'medium',
    }),
  }),
  teamAddToTeamContacts: C.makeScreen(React.lazy(async () => import('./add-members-wizard/add-contacts')), {
    getOptions: ({route}) => ({
      ...Kb.modalBackLeftOptions,
      // iOS: the screen drives unstable_headerRightItems via useModalHeaderAction
      ...(isIOS ? {} : {headerRight: () => <AddContactsHeaderRight />}),
      headerTitle: () => <AddContactsHeaderTitle wizard={route.params.wizard} />,
      modalSize: 'medium',
    }),
  }),
  teamAddToTeamEmail: C.makeScreen(React.lazy(async () => import('./add-members-wizard/add-email')), {
    getOptions: ({route}) => ({
      ...Kb.modalBackLeftOptions,
      headerTitle: () => <WizardEmailHeaderTitle wizard={route.params.wizard} />,
      modalSize: 'medium',
    }),
  }),
  teamAddToTeamFromWhere: C.makeScreen(React.lazy(async () => import('./add-members-wizard/add-from-where')), {
    getOptions: ({route}) => ({
      ...(isIOS
        ? {
            unstable_headerLeftItems: () =>
              route.params.wizard.teamID === T.Teams.newTeamWizardTeamID
                ? [Kb.nativeBackHeaderItem(C.Router2.navigateUp)]
                : [Kb.nativeCancelHeaderItem(C.Router2.clearModals)],
          }
        : {headerLeft: (p: HeaderBackButtonProps) => <AddFromWhereHeaderLeft {...p} wizard={route.params.wizard} />}),
      // Only register a right item when Skip actually renders: on iOS 26 a custom header
      // view that renders nothing still draws an empty glass pill.
      ...(route.params.wizard.teamID === T.Teams.newTeamWizardTeamID
        ? {headerRight: () => <AddFromWhereSkip wizard={route.params.wizard} />}
        : {}),
      headerTitle: () => <AddFromWhereHeaderTitle wizard={route.params.wizard} />,
      modalSize: 'medium',
    }),
  }),
  teamAddToTeamPhone: C.makeScreen(React.lazy(async () => import('./add-members-wizard/add-phone')), {
    getOptions: ({route}) => ({
      ...Kb.modalBackLeftOptions,
      headerTitle: () => <WizardPhoneHeaderTitle wizard={route.params.wizard} />,
      modalSize: 'medium',
    }),
  }),
  teamCreateChannels: C.makeScreen(React.lazy(async () => import('./channel/create-channels')), {
    getOptions: ({route}) => ({
      ...Kb.modalBackLeftOptions,
      headerTitle: () => <ModalTitle teamID={route.params.teamID} title="Create channels" />,
    }),
  }),
  teamDeleteChannel: C.makeScreen(React.lazy(async () => import('./confirm-modals/delete-channel')), {
    getOptions: ({route}) => ({
      title: (route.params.conversationIDKeys?.length ?? 0) > 1 ? 'Delete channels' : 'Delete channel',
    }),
  }),
  teamDeleteTeam: C.makeScreen(React.lazy(async () => import('./delete-team')), {
    getOptions: {title: 'Delete team'},
  }),
  teamEditChannel: C.makeScreen(React.lazy(async () => import('./team/member/edit-channel')), {
    getOptions: ({route}) => ({
      ...Kb.modalBackLeftOptions,
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
      ...Kb.modalBackLeftOptions,
      headerTitle: () => <TeamInfoHeaderTitle teamID={route.params.teamID} />,
    }),
  }),
  teamInviteByContact: C.makeScreen(React.lazy(async () => import('./invite-by-contact/team-invite-by-contacts')), {
    getOptions: {modalSize: 'medium', title: 'Invite contacts'},
  }),
  teamInviteByEmail: C.makeScreen(React.lazy(async () => import('./invite-by-email')), {
    getOptions: ({route}) => ({
      headerTitle: () => <ModalTitle teamID={route.params.teamID} title="Invite by email" />,
    }),
  }),
  teamInviteLinkJoin: C.makeScreen(React.lazy(async () => import('./join-team/join-from-invite')), {
    getOptions: {title: 'Join team'},
  }),
  teamJoinTeamDialog: C.makeScreen(React.lazy(async () => import('./join-team/container')), {
    getOptions: ({route}) => ({
      ...(isIOS
        ? {
            unstable_headerLeftItems: () =>
              route.params.success ? [] : [Kb.nativeBackHeaderItem()],
          }
        : {headerLeft: () => <JoinTeamHeaderLeft success={route.params.success} />}),
      headerTitle: () => <JoinTeamHeaderTitle success={route.params.success} />,
    }),
  }),
  teamNewTeamDialog: C.makeScreen(React.lazy(async () => import('./new-team')), {
    getOptions: {title: 'Create a team'},
  }),
  teamReallyLeaveTeam: C.makeScreen(React.lazy(async () => import('./confirm-modals/really-leave-team')), {
    getOptions: {title: 'Leave team'},
  }),
  teamReallyRemoveChannelMember: C.makeScreen(
    React.lazy(async () => import('./confirm-modals/confirm-remove-from-channel')),
    {getOptions: {title: 'Remove from channel'}}
  ),
  teamReallyRemoveMember: C.makeScreen(React.lazy(async () => import('./confirm-modals/confirm-kick-out')), {
    getOptions: {title: 'Remove member'},
  }),
  teamRename: C.makeScreen(React.lazy(async () => import('./rename-team')), {
    getOptions: {title: 'Rename subteam'},
  }),
  teamWizard1TeamPurpose: C.makeScreen(React.lazy(async () => import('./new-team/wizard/team-purpose')), {
    getOptions: ({route}) => ({
      headerTitle: () => <ModalTitle teamID={T.Teams.noTeamID} title="New team" newTeamWizard={route.params.wizard} />,
      modalSize: 'medium',
    }),
  }),
  teamWizard2TeamInfo: C.makeScreen(React.lazy(async () => import('./new-team/wizard/new-team-info')), {
    getOptions: ({route}) => ({
      ...(isIOS
        ? {
            unstable_headerLeftItems: () =>
              route.params.wizard.teamType === 'subteam'
                ? [Kb.nativeCancelHeaderItem(C.Router2.clearModals)]
                : [Kb.nativeBackHeaderItem(C.Router2.navigateUp)],
          }
        : {headerLeft: (p: HeaderBackButtonProps) => <NewTeamInfoHeaderLeft {...p} wizard={route.params.wizard} />}),
      headerTitle: () => <NewTeamInfoHeaderTitle wizard={route.params.wizard} />,
      modalSize: 'medium',
    }),
  }),
  teamWizard4TeamSize: C.makeScreen(React.lazy(async () => import('./new-team/wizard/make-big-team')), {
    getOptions: ({route}) => ({
      ...Kb.modalBackLeftOptions,
      headerTitle: () => (
        <ModalTitle teamID={T.Teams.newTeamWizardTeamID} title="Make it a big team?" newTeamWizard={route.params.wizard} />
      ),
      modalSize: 'medium',
    }),
  }),
  teamWizard5Channels: C.makeScreen(React.lazy(async () => import('./new-team/wizard/create-channels')), {
    getOptions: ({route}) => ({
      ...Kb.modalBackLeftOptions,
      headerTitle: () => (
        <ModalTitle teamID={T.Teams.newTeamWizardTeamID} title="Create channels" newTeamWizard={route.params.wizard} />
      ),
      modalSize: 'medium',
    }),
  }),
  teamWizard6Subteams: C.makeScreen(React.lazy(async () => import('./new-team/wizard/create-subteams')), {
    getOptions: ({route}) => ({
      ...Kb.modalBackLeftOptions,
      headerTitle: () => (
        <ModalTitle teamID={T.Teams.newTeamWizardTeamID} title="Create subteams" newTeamWizard={route.params.wizard} />
      ),
      modalSize: 'medium',
    }),
  }),
  teamWizardSubteamMembers: C.makeScreen(React.lazy(async () => import('./new-team/wizard/add-subteam-members')), {
    getOptions: ({route}) => ({
      ...Kb.modalBackLeftOptions,
      // iOS: the screen drives unstable_headerRightItems via useModalHeaderAction
      ...(isIOS ? {} : {headerRight: () => <SubteamMembersHeaderRight />}),
      headerTitle: () => <ModalTitle teamID={T.Teams.newTeamWizardTeamID} title="Add members" newTeamWizard={route.params.wizard} />,
      modalSize: 'medium',
    }),
  }),
  teamsTeamBuilder: {
    ...teamsTeamBuilder,
    screen: TeamsTeamBuilderScreen,
  },
})
