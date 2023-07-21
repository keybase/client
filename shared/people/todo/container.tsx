import * as React from 'react'
import * as Container from '../../util/container'
import * as Constants from '../../constants/people'
import * as TrackerConstants from '../../constants/tracker2'
import * as TeamsConstants from '../../constants/teams'
import * as ProfileConstants from '../../constants/profile'
import * as RouterConstants from '../../constants/router2'
import * as SettingsConstants from '../../constants/settings'
import * as ConfigConstants from '../../constants/config'
import * as Tabs from '../../constants/tabs'
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
const useOnSkipTodo = (type: Types.TodoType) => {
  const skipTodo = Constants.useState(s => s.dispatch.skipTodo)
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
  const switchTab = RouterConstants.useState(s => s.dispatch.switchTab)
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
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
  const switchTab = RouterConstants.useState(s => s.dispatch.switchTab)
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
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
  const switchTab = RouterConstants.useState(s => s.dispatch.switchTab)
  const onConfirm = () => switchTab(Tabs.teamsTab)
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel)
  return <Task {...props} buttons={buttons} />
}

const AvatarUserConnector = (props: TodoOwnProps) => {
  const editAvatar = ProfileConstants.useState(s => s.dispatch.editAvatar)
  const onConfirm = editAvatar
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel)
  return <Task {...props} buttons={buttons} />
}

const BioConnector = (props: TodoOwnProps) => {
  const myUsername = ConfigConstants.useCurrentUserState(s => s.username)
  const showUser = TrackerConstants.useState(s => s.dispatch.showUser)
  const onConfirm = (username: string) => {
    // make sure we have tracker state & profile is up to date
    showUser(username, false)
  }
  const buttons = makeDefaultButtons(() => onConfirm(myUsername), props.confirmLabel)
  return <Task {...props} buttons={buttons} />
}

const ProofConnector = (props: TodoOwnProps) => {
  const myUsername = ConfigConstants.useCurrentUserState(s => s.username)
  const showUserProfile = ProfileConstants.useState(s => s.dispatch.showUserProfile)
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
  const switchTab = RouterConstants.useState(s => s.dispatch.switchTab)
  const onConfirm = () => switchTab(Tabs.chatTab)
  const onDismiss = useOnSkipTodo('chat')
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel, onDismiss)
  return <Task {...props} buttons={buttons} />
}

const PaperKeyConnector = (props: TodoOwnProps) => {
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
  const onConfirm = () => navigateAppend({props: {highlight: ['paper key']}, selected: 'deviceAdd'})
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel)
  return <Task {...props} buttons={buttons} />
}

const TeamConnector = (props: TodoOwnProps) => {
  const switchTab = RouterConstants.useState(s => s.dispatch.switchTab)
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
  const switchTab = RouterConstants.useState(s => s.dispatch.switchTab)
  const onConfirm = () => switchTab(Tabs.fsTab)
  const onDismiss = useOnSkipTodo('folder')
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel, onDismiss)
  return <Task {...props} buttons={buttons} />
}

const GitRepoConnector = (props: TodoOwnProps) => {
  const switchTab = RouterConstants.useState(s => s.dispatch.switchTab)
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
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
  const switchTab = RouterConstants.useState(s => s.dispatch.switchTab)
  const onConfirm = () => switchTab(Tabs.teamsTab)
  const onDismiss = useOnSkipTodo('teamShowcase')
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel, onDismiss)
  return <Task {...props} buttons={buttons} />
}

const VerifyAllEmailConnector = (props: TodoOwnProps) => {
  const addingEmail = SettingsConstants.useEmailState(s => s.addingEmail)
  const setResentEmail = Constants.useState(s => s.dispatch.setResentEmail)
  const editEmail = SettingsConstants.useEmailState(s => s.dispatch.editEmail)
  const onConfirm = (email: string) => {
    editEmail({email, verify: true})
    setResentEmail(email)
  }
  const switchTab = RouterConstants.useState(s => s.dispatch.switchTab)
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
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
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
  const onConfirm = (phoneNumber: string) => {
    resendVerificationForPhone(phoneNumber)
    navigateAppend('settingsVerifyPhone')
  }
  const switchTab = RouterConstants.useState(s => s.dispatch.switchTab)
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
  const switchTab = RouterConstants.useState(s => s.dispatch.switchTab)
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
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
