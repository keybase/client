import * as Container from '../../util/container'
import * as PeopleGen from '../../actions/people-gen'
import * as ProfileGen from '../../actions/profile-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SettingsGen from '../../actions/settings-gen'
import * as SettingsTabs from '../../constants/settings'
import * as Tabs from '../../constants/tabs'
import * as TeamsGen from '../../actions/teams-gen'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import openURL from '../../util/open-url'
import type * as Types from '../../constants/types/people'
import type {IconType} from '../../common-adapters/icon.constants-gen'
import type {TaskButton} from '../item'
import {Task} from '.'
import {appendPeopleBuilder} from '../../actions/typed-routes'
import {todoTypes} from '../../constants/people'

type TodoOwnProps = {
  badged: boolean
  confirmLabel: string
  icon: IconType
  instructions: string
  metadata: Types.TodoMeta
  todoType: Types.TodoType
}

const installLinkURL = 'https://keybase.io/download'
const onSkipTodo = (type: Types.TodoType, dispatch: Container.TypedDispatch) => () =>
  dispatch(PeopleGen.createSkipTodo({type}))

function makeDefaultButtons(
  onConfirm: () => void,
  confirmLabel: string,
  onDismiss?: () => void,
  dismissLabel?: string
) {
  const result: Array<TaskButton> = [
    {
      label: confirmLabel,
      onClick: onConfirm,
    },
  ]
  if (onDismiss) {
    result.push({
      label: dismissLabel || 'Skip',
      mode: 'Secondary',
      onClick: onDismiss,
    })
  }
  return result
}

const AddEmailConnector = (props: TodoOwnProps) => {
  const dispatch = Container.useDispatch()
  const onConfirm = () => {
    dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.settingsTab}))
    dispatch(RouteTreeGen.createNavigateAppend({path: [SettingsTabs.accountTab]}))
    dispatch(RouteTreeGen.createNavigateAppend({path: ['settingsAddEmail']}))
  }
  const onDismiss = onSkipTodo('addEmail', dispatch)
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel, onDismiss)
  return <Task {...props} buttons={buttons} />
}

const AddPhoneNumberConnector = (props: TodoOwnProps) => {
  const dispatch = Container.useDispatch()
  const onConfirm = () => {
    dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.settingsTab}))
    dispatch(RouteTreeGen.createNavigateAppend({path: [SettingsTabs.accountTab]}))
    dispatch(RouteTreeGen.createNavigateAppend({path: ['settingsAddPhone']}))
  }
  const onDismiss = onSkipTodo('addPhoneNumber', dispatch)
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel, onDismiss)
  return <Task {...props} buttons={buttons} />
}

const AvatarTeamConnector = (props: TodoOwnProps) => {
  const dispatch = Container.useDispatch()
  const onConfirm = () => dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.teamsTab}))
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel)
  return <Task {...props} buttons={buttons} />
}

const AvatarUserConnector = (props: TodoOwnProps) => {
  const dispatch = Container.useDispatch()
  const onConfirm = () => dispatch(ProfileGen.createEditAvatar())
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel)
  return <Task {...props} buttons={buttons} />
}

const BioConnector = (props: TodoOwnProps) => {
  const myUsername = Container.useSelector(state => state.config.username)
  const dispatch = Container.useDispatch()
  const onConfirm = (username: string) => {
    // make sure we have tracker state & profile is up to date
    dispatch(Tracker2Gen.createShowUser({asTracker: false, username}))
  }
  const buttons = makeDefaultButtons(() => onConfirm(myUsername), props.confirmLabel)
  return <Task {...props} buttons={buttons} />
}

const ProofConnector = (props: TodoOwnProps) => {
  const myUsername = Container.useSelector(state => state.config.username)
  const dispatch = Container.useDispatch()
  const onConfirm = (username: string) => dispatch(ProfileGen.createShowUserProfile({username}))
  const onDismiss = onSkipTodo('proof', dispatch)
  const buttons = makeDefaultButtons(() => onConfirm(myUsername), props.confirmLabel, onDismiss)
  return <Task {...props} buttons={buttons} />
}

const DeviceConnector = (props: TodoOwnProps) => {
  const dispatch = Container.useDispatch()
  const onConfirm = () => openURL(installLinkURL)
  const onDismiss = onSkipTodo('device', dispatch)
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel, onDismiss)
  return <Task {...props} buttons={buttons} />
}

const FollowConnector = (props: TodoOwnProps) => {
  const dispatch = Container.useDispatch()
  const onConfirm = () => {
    dispatch(appendPeopleBuilder())
  }
  const onDismiss = onSkipTodo('follow', dispatch)
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel, onDismiss)
  return <Task {...props} buttons={buttons} />
}

const ChatConnector = (props: TodoOwnProps) => {
  const dispatch = Container.useDispatch()
  const onConfirm = () => dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.chatTab}))
  const onDismiss = onSkipTodo('chat', dispatch)
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel, onDismiss)
  return <Task {...props} buttons={buttons} />
}

const PaperKeyConnector = (props: TodoOwnProps) => {
  const dispatch = Container.useDispatch()
  const onConfirm = () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {highlight: ['paper key']}, selected: 'deviceAdd'}],
      })
    )
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel)
  return <Task {...props} buttons={buttons} />
}

const TeamConnector = (props: TodoOwnProps) => {
  const dispatch = Container.useDispatch()
  const onConfirm = () => {
    dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.teamsTab}))
    dispatch(TeamsGen.createLaunchNewTeamWizardOrModal())
  }
  const onDismiss = onSkipTodo('team', dispatch)
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel, onDismiss)
  return <Task {...props} buttons={buttons} />
}

const FolderConnector = (props: TodoOwnProps) => {
  const dispatch = Container.useDispatch()
  const onConfirm = () => dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.fsTab}))
  const onDismiss = onSkipTodo('folder', dispatch)
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel, onDismiss)
  return <Task {...props} buttons={buttons} />
}

const GitRepoConnector = (props: TodoOwnProps) => {
  const dispatch = Container.useDispatch()
  const onConfirm = (isTeam: boolean) => {
    if (Container.isMobile) {
      dispatch(RouteTreeGen.createNavigateAppend({path: [SettingsTabs.gitTab]}))
    } else {
      dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.gitTab}))
    }
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {isTeam}, selected: 'gitNewRepo'}]}))
  }
  const onDismiss = onSkipTodo('gitRepo', dispatch)
  const buttons: Array<TaskButton> = [
    {
      label: 'Create a personal repo',
      onClick: () => onConfirm(false),
    },
    {
      label: 'Create a team repo',
      onClick: () => onConfirm(true),
    },
    {
      label: 'Skip',
      mode: 'Secondary',
      onClick: onDismiss,
    },
  ]
  return <Task {...props} buttons={buttons} />
}

const TeamShowcaseConnector = (props: TodoOwnProps) => {
  const dispatch = Container.useDispatch()
  const onConfirm = () => dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.teamsTab}))
  const onDismiss = onSkipTodo('teamShowcase', dispatch)
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel, onDismiss)
  return <Task {...props} buttons={buttons} />
}

const VerifyAllEmailConnector = (props: TodoOwnProps) => {
  const addingEmail = Container.useSelector(state => state.settings.email.addingEmail)
  const dispatch = Container.useDispatch()
  const onConfirm = (email: string) => {
    dispatch(SettingsGen.createEditEmail({email, verify: true}))
    dispatch(PeopleGen.createSetResentEmail({email}))
  }
  const onManage = () => {
    dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.settingsTab}))
    dispatch(RouteTreeGen.createNavigateAppend({path: [SettingsTabs.accountTab]}))
  }

  const meta = props.metadata && props.metadata.type === 'email' ? props.metadata : undefined

  // Has the user received a verification email less than 30 minutes ago?
  const hasRecentVerifyEmail =
    meta?.lastVerifyEmailDate && Date.now() / 1000 - meta.lastVerifyEmailDate < 30 * 60

  const buttons: Array<TaskButton> = [
    ...(meta
      ? [
          {
            label: hasRecentVerifyEmail ? `Verify again` : 'Verify',
            onClick: () => onConfirm(meta.email),
            type: 'Success' as const,
            waiting: addingEmail ? addingEmail === meta.email : false,
          },
        ]
      : []),
    {
      label: 'Manage emails',
      mode: 'Secondary',
      onClick: onManage,
    },
  ]
  return <Task {...props} buttons={buttons} />
}

const VerifyAllPhoneNumberConnector = (props: TodoOwnProps) => {
  const dispatch = Container.useDispatch()
  const onConfirm = (phoneNumber: string) => {
    dispatch(SettingsGen.createResendVerificationForPhoneNumber({phoneNumber}))
    dispatch(RouteTreeGen.createNavigateAppend({path: ['settingsVerifyPhone']}))
  }
  const onManage = () => {
    dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.settingsTab}))
    dispatch(RouteTreeGen.createNavigateAppend({path: [SettingsTabs.accountTab]}))
  }
  const buttons: Array<TaskButton> = [
    ...(props.metadata
      ? [
          {
            label: 'Verify',
            onClick: () => {
              const meta = props.metadata
              meta && meta.type === 'phone' && onConfirm(meta.phone)
            },
            type: 'Success' as const,
          },
        ]
      : []),
    {
      label: 'Manage numbers',
      mode: 'Secondary',
      onClick: onManage,
    },
  ]
  return <Task {...props} buttons={buttons} />
}

const LegacyEmailVisibilityConnector = (props: TodoOwnProps) => {
  const dispatch = Container.useDispatch()
  const onConfirm = (email: string) => {
    dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.settingsTab}))
    dispatch(RouteTreeGen.createNavigateAppend({path: [SettingsTabs.accountTab]}))
    dispatch(SettingsGen.createEditEmail({email, makeSearchable: true}))
  }
  const onDismiss = onSkipTodo('legacyEmailVisibility', dispatch)
  const buttons: Array<TaskButton> = [
    ...(props.metadata
      ? [
          {
            label: 'Make searchable',
            onClick: () => {
              const meta = props.metadata
              meta && meta.type === 'email' && onConfirm(meta.email)
            },
            type: 'Success' as const,
          },
        ]
      : []),
    {
      label: 'No',
      mode: 'Secondary',
      onClick: onDismiss,
    },
  ]
  const subText = 'Your email will never appear on your public profile.'
  return <Task {...props} buttons={buttons} subText={subText} />
}

const TaskChooser = (props: TodoOwnProps) => {
  switch (props.todoType) {
    case todoTypes.addEmail:
      return <AddEmailConnector {...props} />
    case todoTypes.addPhoneNumber:
      return <AddPhoneNumberConnector {...props} />
    case todoTypes.avatarTeam:
      return <AvatarTeamConnector {...props} />
    case todoTypes.avatarUser:
      return <AvatarUserConnector {...props} />
    case todoTypes.bio:
      return <BioConnector {...props} />
    case todoTypes.proof:
      return <ProofConnector {...props} />
    case todoTypes.device:
      return <DeviceConnector {...props} />
    case todoTypes.follow:
      return <FollowConnector {...props} />
    case todoTypes.chat:
      return <ChatConnector {...props} />
    case todoTypes.paperkey:
      return <PaperKeyConnector {...props} />
    case todoTypes.team:
      return <TeamConnector {...props} />
    case todoTypes.folder:
      return <FolderConnector {...props} />
    case todoTypes.gitRepo:
      return <GitRepoConnector {...props} />
    case todoTypes.legacyEmailVisibility:
      return <LegacyEmailVisibilityConnector {...props} />
    case todoTypes.teamShowcase:
      return <TeamShowcaseConnector {...props} />
    case todoTypes.verifyAllEmail:
      return <VerifyAllEmailConnector {...props} />
    case todoTypes.verifyAllPhoneNumber:
      return <VerifyAllPhoneNumberConnector {...props} />
    default:
      return null
  }
}

export default TaskChooser
