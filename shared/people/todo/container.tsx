import * as C from '../../constants'
import * as React from 'react'
import * as Container from '../../util/container'
import * as TrackerConstants from '../../constants/tracker2'
import * as TeamsConstants from '../../constants/teams'
import * as SettingsConstants from '../../constants/settings'
import * as Tabs from '../../constants/tabs'
import openURL from '../../util/open-url'
import type * as Types from '../../constants/types/people'
import type {IconType} from '../../common-adapters/icon.constants-gen'
import type {TaskButton} from '../item'
import {Task} from '.'
import {appendPeopleBuilder} from '../../actions/typed-routes'

type TodoOwnProps = {
  badged: boolean
  confirmLabel: string
  icon: IconType
  instructions: string
  metadata: Types.TodoMeta
  todoType: Types.TodoType
}

const installLinkURL = 'https://keybase.io/download'
const useOnSkipTodo = (type: Types.TodoType) => {
  const skipTodo = C.usePeopleState(s => s.dispatch.skipTodo)
  return React.useCallback(() => {
    skipTodo(type)
  }, [skipTodo, type])
}

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
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onConfirm = () => {
    switchTab(Tabs.settingsTab)
    navigateAppend(SettingsConstants.accountTab)
    navigateAppend('settingsAddEmail')
  }
  const onDismiss = useOnSkipTodo('addEmail')
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel, onDismiss)
  return <Task {...props} buttons={buttons} />
}

const AddPhoneNumberConnector = (props: TodoOwnProps) => {
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onConfirm = () => {
    switchTab(Tabs.settingsTab)
    navigateAppend(SettingsConstants.accountTab)
    navigateAppend('settingsAddPhone')
  }
  const onDismiss = useOnSkipTodo('addPhoneNumber')
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel, onDismiss)
  return <Task {...props} buttons={buttons} />
}

const AvatarTeamConnector = (props: TodoOwnProps) => {
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
  const onConfirm = () => switchTab(Tabs.teamsTab)
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel)
  return <Task {...props} buttons={buttons} />
}

const AvatarUserConnector = (props: TodoOwnProps) => {
  const editAvatar = C.useProfileState(s => s.dispatch.editAvatar)
  const onConfirm = editAvatar
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel)
  return <Task {...props} buttons={buttons} />
}

const BioConnector = (props: TodoOwnProps) => {
  const myUsername = C.useCurrentUserState(s => s.username)
  const showUser = TrackerConstants.useState(s => s.dispatch.showUser)
  const onConfirm = (username: string) => {
    // make sure we have tracker state & profile is up to date
    showUser(username, false)
  }
  const buttons = makeDefaultButtons(() => onConfirm(myUsername), props.confirmLabel)
  return <Task {...props} buttons={buttons} />
}

const ProofConnector = (props: TodoOwnProps) => {
  const myUsername = C.useCurrentUserState(s => s.username)
  const showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)
  const onConfirm = showUserProfile
  const onDismiss = useOnSkipTodo('proof')
  const buttons = makeDefaultButtons(() => onConfirm(myUsername), props.confirmLabel, onDismiss)
  return <Task {...props} buttons={buttons} />
}

const DeviceConnector = (props: TodoOwnProps) => {
  const onConfirm = () => openURL(installLinkURL)
  const onDismiss = useOnSkipTodo('device')
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel, onDismiss)
  return <Task {...props} buttons={buttons} />
}

const FollowConnector = (props: TodoOwnProps) => {
  const onConfirm = () => {
    appendPeopleBuilder()
  }
  const onDismiss = useOnSkipTodo('follow')
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel, onDismiss)
  return <Task {...props} buttons={buttons} />
}

const ChatConnector = (props: TodoOwnProps) => {
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
  const onConfirm = () => switchTab(Tabs.chatTab)
  const onDismiss = useOnSkipTodo('chat')
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel, onDismiss)
  return <Task {...props} buttons={buttons} />
}

const PaperKeyConnector = (props: TodoOwnProps) => {
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onConfirm = () => navigateAppend({props: {highlight: ['paper key']}, selected: 'deviceAdd'})
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel)
  return <Task {...props} buttons={buttons} />
}

const TeamConnector = (props: TodoOwnProps) => {
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
  const launchNewTeamWizardOrModal = TeamsConstants.useState(s => s.dispatch.launchNewTeamWizardOrModal)
  const onConfirm = () => {
    switchTab(Tabs.teamsTab)
    launchNewTeamWizardOrModal()
  }
  const onDismiss = useOnSkipTodo('team')
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel, onDismiss)
  return <Task {...props} buttons={buttons} />
}

const FolderConnector = (props: TodoOwnProps) => {
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
  const onConfirm = () => switchTab(Tabs.fsTab)
  const onDismiss = useOnSkipTodo('folder')
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel, onDismiss)
  return <Task {...props} buttons={buttons} />
}

const GitRepoConnector = (props: TodoOwnProps) => {
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onConfirm = (isTeam: boolean) => {
    if (Container.isMobile) {
      navigateAppend({props: {}, selected: SettingsConstants.gitTab})
    } else {
      switchTab(Tabs.gitTab)
    }
    navigateAppend({props: {isTeam}, selected: 'gitNewRepo'})
  }
  const onDismiss = useOnSkipTodo('gitRepo')
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
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
  const onConfirm = () => switchTab(Tabs.teamsTab)
  const onDismiss = useOnSkipTodo('teamShowcase')
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel, onDismiss)
  return <Task {...props} buttons={buttons} />
}

const VerifyAllEmailConnector = (props: TodoOwnProps) => {
  const addingEmail = SettingsConstants.useEmailState(s => s.addingEmail)
  const setResentEmail = C.usePeopleState(s => s.dispatch.setResentEmail)
  const editEmail = SettingsConstants.useEmailState(s => s.dispatch.editEmail)
  const onConfirm = (email: string) => {
    editEmail({email, verify: true})
    setResentEmail(email)
  }
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onManage = () => {
    switchTab(Tabs.settingsTab)
    navigateAppend(SettingsConstants.accountTab)
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
  const resendVerificationForPhone = SettingsConstants.usePhoneState(
    s => s.dispatch.resendVerificationForPhone
  )
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onConfirm = (phoneNumber: string) => {
    resendVerificationForPhone(phoneNumber)
    navigateAppend('settingsVerifyPhone')
  }
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
  const onManage = () => {
    switchTab(Tabs.settingsTab)
    navigateAppend(SettingsConstants.accountTab)
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
  const editEmail = SettingsConstants.useEmailState(s => s.dispatch.editEmail)
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onConfirm = (email: string) => {
    switchTab(Tabs.settingsTab)
    navigateAppend(SettingsConstants.accountTab)
    editEmail({email, makeSearchable: true})
  }
  const onDismiss = useOnSkipTodo('legacyEmailVisibility')
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
    case C.todoTypes.addEmail:
      return <AddEmailConnector {...props} />
    case C.todoTypes.addPhoneNumber:
      return <AddPhoneNumberConnector {...props} />
    case C.todoTypes.avatarTeam:
      return <AvatarTeamConnector {...props} />
    case C.todoTypes.avatarUser:
      return <AvatarUserConnector {...props} />
    case C.todoTypes.bio:
      return <BioConnector {...props} />
    case C.todoTypes.proof:
      return <ProofConnector {...props} />
    case C.todoTypes.device:
      return <DeviceConnector {...props} />
    case C.todoTypes.follow:
      return <FollowConnector {...props} />
    case C.todoTypes.chat:
      return <ChatConnector {...props} />
    case C.todoTypes.paperkey:
      return <PaperKeyConnector {...props} />
    case C.todoTypes.team:
      return <TeamConnector {...props} />
    case C.todoTypes.folder:
      return <FolderConnector {...props} />
    case C.todoTypes.gitRepo:
      return <GitRepoConnector {...props} />
    case C.todoTypes.legacyEmailVisibility:
      return <LegacyEmailVisibilityConnector {...props} />
    case C.todoTypes.teamShowcase:
      return <TeamShowcaseConnector {...props} />
    case C.todoTypes.verifyAllEmail:
      return <VerifyAllEmailConnector {...props} />
    case C.todoTypes.verifyAllPhoneNumber:
      return <VerifyAllPhoneNumberConnector {...props} />
    default:
      return null
  }
}

export default TaskChooser
