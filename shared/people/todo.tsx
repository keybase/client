import * as C from '@/constants'
import {useTeamsState} from '@/stores/teams'
import * as React from 'react'
import openURL from '@/util/open-url'
import type * as T from '@/constants/types'
import type {IconType} from '@/common-adapters/icon.constants-gen'
import PeopleItem, {type TaskButton} from './item'
import * as Kb from '@/common-adapters'
import {useSettingsPhoneState} from '@/stores/settings-phone'
import {useSettingsEmailState} from '@/stores/settings-email'
import {settingsAccountTab, settingsGitTab} from '@/constants/settings'
import {useTrackerState} from '@/stores/tracker2'
import {useProfileState} from '@/stores/profile'
import {usePeopleState, todoTypes} from '@/stores/people'
import {useCurrentUserState} from '@/stores/current-user'

type TodoOwnProps = {
  badged: boolean
  confirmLabel: string
  icon: IconType
  instructions: string
  metadata: T.People.TodoMeta
  todoType: T.People.TodoType
}

const installLinkURL = 'https://keybase.io/download'
const useOnSkipTodo = (type: T.People.TodoType) => {
  const skipTodo = usePeopleState(s => s.dispatch.skipTodo)
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
  const {navigateAppend, switchTab} = C.useRouterState(
    C.useShallow(s => ({
      navigateAppend: s.dispatch.navigateAppend,
      switchTab: s.dispatch.switchTab,
    }))
  )
  const onConfirm = () => {
    switchTab(C.Tabs.settingsTab)
    navigateAppend(settingsAccountTab)
    navigateAppend('settingsAddEmail')
  }
  const onDismiss = useOnSkipTodo('addEmail')
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel, onDismiss)
  return <Task {...props} buttons={buttons} />
}

const AddPhoneNumberConnector = (props: TodoOwnProps) => {
  const {navigateAppend, switchTab} = C.useRouterState(
    C.useShallow(s => ({
      navigateAppend: s.dispatch.navigateAppend,
      switchTab: s.dispatch.switchTab,
    }))
  )
  const onConfirm = () => {
    switchTab(C.Tabs.settingsTab)
    navigateAppend(settingsAccountTab)
    navigateAppend('settingsAddPhone')
  }
  const onDismiss = useOnSkipTodo('addPhoneNumber')
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel, onDismiss)
  return <Task {...props} buttons={buttons} />
}

const AvatarTeamConnector = (props: TodoOwnProps) => {
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
  const onConfirm = () => switchTab(C.Tabs.teamsTab)
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel)
  return <Task {...props} buttons={buttons} />
}

const AvatarUserConnector = (props: TodoOwnProps) => {
  const editAvatar = useProfileState(s => s.dispatch.editAvatar)
  const onConfirm = editAvatar
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel)
  return <Task {...props} buttons={buttons} />
}

const BioConnector = (props: TodoOwnProps) => {
  const myUsername = useCurrentUserState(s => s.username)
  const showUser = useTrackerState(s => s.dispatch.showUser)
  const onConfirm = (username: string) => {
    // make sure we have tracker state & profile is up to date
    showUser(username, false)
  }
  const buttons = makeDefaultButtons(() => onConfirm(myUsername), props.confirmLabel)
  return <Task {...props} buttons={buttons} />
}

const ProofConnector = (props: TodoOwnProps) => {
  const myUsername = useCurrentUserState(s => s.username)
  const showUserProfile = useProfileState(s => s.dispatch.showUserProfile)
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
  const appendPeopleBuilder = C.useRouterState(s => s.appendPeopleBuilder)
  const onConfirm = () => {
    appendPeopleBuilder()
  }
  const onDismiss = useOnSkipTodo('follow')
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel, onDismiss)
  return <Task {...props} buttons={buttons} />
}

const ChatConnector = (props: TodoOwnProps) => {
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
  const onConfirm = () => switchTab(C.Tabs.chatTab)
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
  const launchNewTeamWizardOrModal = useTeamsState(s => s.dispatch.launchNewTeamWizardOrModal)
  const onConfirm = () => {
    switchTab(C.Tabs.teamsTab)
    launchNewTeamWizardOrModal()
  }
  const onDismiss = useOnSkipTodo('team')
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel, onDismiss)
  return <Task {...props} buttons={buttons} />
}

const FolderConnector = (props: TodoOwnProps) => {
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
  const onConfirm = () => switchTab(C.Tabs.fsTab)
  const onDismiss = useOnSkipTodo('folder')
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel, onDismiss)
  return <Task {...props} buttons={buttons} />
}

const GitRepoConnector = (props: TodoOwnProps) => {
  const {navigateAppend, switchTab} = C.useRouterState(
    C.useShallow(s => ({
      navigateAppend: s.dispatch.navigateAppend,
      switchTab: s.dispatch.switchTab,
    }))
  )
  const onConfirm = (isTeam: boolean) => {
    if (C.isMobile) {
      navigateAppend(settingsGitTab)
    } else {
      switchTab(C.Tabs.gitTab)
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
  const onConfirm = () => switchTab(C.Tabs.teamsTab)
  const onDismiss = useOnSkipTodo('teamShowcase')
  const buttons = makeDefaultButtons(onConfirm, props.confirmLabel, onDismiss)
  return <Task {...props} buttons={buttons} />
}

const VerifyAllEmailConnector = (props: TodoOwnProps) => {
  const {addingEmail, editEmail} = useSettingsEmailState(
    C.useShallow(s => ({
      addingEmail: s.addingEmail,
      editEmail: s.dispatch.editEmail,
    }))
  )
  const setResentEmail = usePeopleState(s => s.dispatch.setResentEmail)
  const onConfirm = (email: string) => {
    editEmail({email, verify: true})
    setResentEmail(email)
  }
  const {navigateAppend, switchTab} = C.useRouterState(
    C.useShallow(s => ({
      navigateAppend: s.dispatch.navigateAppend,
      switchTab: s.dispatch.switchTab,
    }))
  )
  const onManage = () => {
    switchTab(C.Tabs.settingsTab)
    navigateAppend(settingsAccountTab)
  }

  const meta = props.metadata?.type === 'email' ? props.metadata : undefined

  const [now] = React.useState(() => Date.now())
  // Has the user received a verification email less than 30 minutes ago?
  const hasRecentVerifyEmail = meta?.lastVerifyEmailDate && now / 1000 - meta.lastVerifyEmailDate < 30 * 60

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
  const resendVerificationForPhone = useSettingsPhoneState(s => s.dispatch.resendVerificationForPhone)
  const {navigateAppend, switchTab} = C.useRouterState(
    C.useShallow(s => ({
      navigateAppend: s.dispatch.navigateAppend,
      switchTab: s.dispatch.switchTab,
    }))
  )
  const onConfirm = (phoneNumber: string) => {
    resendVerificationForPhone(phoneNumber)
    navigateAppend('settingsVerifyPhone')
  }
  const onManage = () => {
    switchTab(C.Tabs.settingsTab)
    navigateAppend(settingsAccountTab)
  }
  const buttons: Array<TaskButton> = [
    ...(props.metadata
      ? [
          {
            label: 'Verify',
            onClick: () => {
              const meta = props.metadata
              meta?.type === 'phone' && onConfirm(meta.phone)
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
  const editEmail = useSettingsEmailState(s => s.dispatch.editEmail)
  const {navigateAppend, switchTab} = C.useRouterState(
    C.useShallow(s => ({
      navigateAppend: s.dispatch.navigateAppend,
      switchTab: s.dispatch.switchTab,
    }))
  )
  const onConfirm = (email: string) => {
    switchTab(C.Tabs.settingsTab)
    navigateAppend(settingsAccountTab)
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
              meta?.type === 'email' && onConfirm(meta.email)
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

type Props = {
  badged: boolean
  icon: Kb.IconType
  instructions: string
  subText?: string
  buttons: Array<TaskButton>
}

const Task = (props: Props) => (
  <PeopleItem
    format="multi"
    badged={props.badged}
    icon={<Kb.Icon type={props.icon} />}
    buttons={props.buttons}
  >
    <Kb.Markdown style={styles.instructions}>{props.instructions}</Kb.Markdown>
    {!!props.subText && <Kb.Text type="BodySmall">{props.subText}</Kb.Text>}
  </PeopleItem>
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  instructions: {marginTop: 2},
  search: {
    alignSelf: undefined,
    flexGrow: 0,
    marginBottom: Kb.Styles.globalMargins.xsmall,
    marginTop: Kb.Styles.globalMargins.xsmall,
  },
}))

export default TaskChooser
