import * as C from '@/constants'
import {useTeamsState} from '@/stores/teams'
import * as React from 'react'
import {editAvatar, openURL} from '@/util/misc'
import type * as T from '@/constants/types'
import type {IconType} from '@/common-adapters/icon.constants-gen'
import PeopleItem, {type TaskButton} from './item'
import * as Kb from '@/common-adapters'
import {useSettingsEmailState} from '@/stores/settings-email'
import {settingsAccountTab, settingsGitTab} from '@/constants/settings'
import type {AppTab} from '@/constants/tabs'
import {useTrackerState} from '@/stores/tracker'
import {useCurrentUserState} from '@/stores/current-user'
import {navToProfile} from '@/constants/router'

const todoTypes: {[K in T.People.TodoType]: T.People.TodoType} = {
  addEmail: 'addEmail',
  addPhoneNumber: 'addPhoneNumber',
  annoncementPlaceholder: 'annoncementPlaceholder', // misspelled in protocol
  avatarTeam: 'avatarTeam',
  avatarUser: 'avatarUser',
  bio: 'bio',
  chat: 'chat',
  device: 'device',
  folder: 'folder',
  follow: 'follow',
  gitRepo: 'gitRepo',
  legacyEmailVisibility: 'legacyEmailVisibility',
  none: 'none',
  paperkey: 'paperkey',
  proof: 'proof',
  team: 'team',
  teamShowcase: 'teamShowcase',
  verifyAllEmail: 'verifyAllEmail',
  verifyAllPhoneNumber: 'verifyAllPhoneNumber',
}

type TodoOwnProps = {
  badged: boolean
  confirmLabel: string
  icon: IconType
  instructions: string
  metadata: T.People.TodoMeta
  setResentEmail: (email: string) => void
  skipTodo: (type: T.People.TodoType) => void
  todoType: T.People.TodoType
}

const installLinkURL = 'https://keybase.io/download'
const useOnSkipTodo = (skipTodo: (type: T.People.TodoType) => void, type?: T.People.TodoType) => () => {
  type && skipTodo(type)
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

const useRouterNavigation = () => C.Router2

type BasicTaskProps = TodoOwnProps & {
  dismissLabel?: string
  dismissTodoType?: T.People.TodoType
  onConfirm: () => void
  subText?: string
}

const BasicTask = ({
  dismissLabel,
  dismissTodoType,
  onConfirm,
  subText,
  ...props
}: BasicTaskProps) => {
  const onDismiss = useOnSkipTodo(props.skipTodo, dismissTodoType)
  return (
    <Task
      {...props}
      subText={subText}
      buttons={makeDefaultButtons(
        onConfirm,
        props.confirmLabel,
        dismissTodoType ? onDismiss : undefined,
        dismissLabel
      )}
    />
  )
}

type SettingsAccountTaskProps = TodoOwnProps & {
  destination?: 'settingsAddEmail' | 'settingsAddPhone'
  dismissTodoType?: T.People.TodoType
}

const SettingsAccountTask = ({
  destination,
  dismissTodoType,
  ...props
}: SettingsAccountTaskProps) => {
  const {navigateAppend, switchTab} = useRouterNavigation()
  const onConfirm = () => {
    switchTab(C.Tabs.settingsTab)
    navigateAppend(settingsAccountTab)
    destination && navigateAppend(destination)
  }
  return <BasicTask {...props} dismissTodoType={dismissTodoType} onConfirm={onConfirm} />
}

type SwitchTabTaskProps = TodoOwnProps & {
  dismissTodoType?: T.People.TodoType
  tab: AppTab
}

const SwitchTabTask = ({dismissTodoType, tab, ...props}: SwitchTabTaskProps) => (
  <BasicTask {...props} dismissTodoType={dismissTodoType} onConfirm={() => C.Router2.switchTab(tab)} />
)

const AvatarUserTask = (props: TodoOwnProps) => (
  <BasicTask {...props} onConfirm={editAvatar} />
)

const BioTask = (props: TodoOwnProps) => {
  const myUsername = useCurrentUserState(s => s.username)
  const showUser = useTrackerState(s => s.dispatch.showUser)
  const onConfirm = () => {
    // Ensure tracker state exists and the profile view is up to date.
    showUser(myUsername, false)
  }
  return <BasicTask {...props} onConfirm={onConfirm} />
}

const ProofTask = (props: TodoOwnProps) => {
  const myUsername = useCurrentUserState(s => s.username)
  return <BasicTask {...props} dismissTodoType="proof" onConfirm={() => navToProfile(myUsername)} />
}

const OpenURLTask = ({
  dismissTodoType,
  url,
  ...props
}: TodoOwnProps & {dismissTodoType?: T.People.TodoType; url: string}) => (
  <BasicTask {...props} dismissTodoType={dismissTodoType} onConfirm={() => openURL(url)} />
)

const FollowTask = (props: TodoOwnProps) => {
  const appendPeopleBuilder = C.Router2.appendPeopleBuilder
  return <BasicTask {...props} dismissTodoType="follow" onConfirm={appendPeopleBuilder} />
}

const PaperKeyTask = (props: TodoOwnProps) => (
  <BasicTask
    {...props}
    onConfirm={() => C.Router2.navigateAppend({name: 'deviceAdd', params: {highlight: ['paper key']}})}
  />
)

const TeamTask = (props: TodoOwnProps) => {
  const launchNewTeamWizardOrModal = useTeamsState(s => s.dispatch.launchNewTeamWizardOrModal)
  return (
    <BasicTask
      {...props}
      dismissTodoType="team"
      onConfirm={() => {
        C.Router2.switchTab(C.Tabs.teamsTab)
        launchNewTeamWizardOrModal()
      }}
    />
  )
}

const GitRepoTask = (props: TodoOwnProps) => {
  const {navigateAppend, switchTab} = useRouterNavigation()
  const onConfirm = (isTeam: boolean) => {
    if (C.isMobile) {
      navigateAppend(settingsGitTab)
    } else {
      switchTab(C.Tabs.gitTab)
    }
    navigateAppend({name: 'gitNewRepo', params: {isTeam}})
  }
  const onDismiss = useOnSkipTodo(props.skipTodo, 'gitRepo')
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

const VerifyAllEmailTask = (props: TodoOwnProps) => {
  const editEmail = useSettingsEmailState(s => s.dispatch.editEmail)
  const onConfirm = (email: string) => {
    editEmail({email, verify: true})
    props.setResentEmail(email)
  }
  const {navigateAppend, switchTab} = useRouterNavigation()
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

const VerifyAllPhoneNumberTask = (props: TodoOwnProps) => {
  const {navigateAppend, switchTab} = useRouterNavigation()
  const onConfirm = (phoneNumber: string) => {
    navigateAppend({name: 'settingsVerifyPhone', params: {initialResend: true, phoneNumber}})
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

const LegacyEmailVisibilityTask = (props: TodoOwnProps) => {
  const editEmail = useSettingsEmailState(s => s.dispatch.editEmail)
  const {navigateAppend, switchTab} = useRouterNavigation()
  const onConfirm = (email: string) => {
    switchTab(C.Tabs.settingsTab)
    navigateAppend(settingsAccountTab)
    editEmail({email, makeSearchable: true})
  }
  const onDismiss = useOnSkipTodo(props.skipTodo, 'legacyEmailVisibility')
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
      return <SettingsAccountTask {...props} dismissTodoType="addEmail" destination="settingsAddEmail" />
    case todoTypes.addPhoneNumber:
      return (
        <SettingsAccountTask {...props} dismissTodoType="addPhoneNumber" destination="settingsAddPhone" />
      )
    case todoTypes.avatarTeam:
      return <SwitchTabTask {...props} tab={C.Tabs.teamsTab} />
    case todoTypes.avatarUser:
      return <AvatarUserTask {...props} />
    case todoTypes.bio:
      return <BioTask {...props} />
    case todoTypes.proof:
      return <ProofTask {...props} />
    case todoTypes.device:
      return <OpenURLTask {...props} dismissTodoType="device" url={installLinkURL} />
    case todoTypes.follow:
      return <FollowTask {...props} />
    case todoTypes.chat:
      return <SwitchTabTask {...props} dismissTodoType="chat" tab={C.Tabs.chatTab} />
    case todoTypes.paperkey:
      return <PaperKeyTask {...props} />
    case todoTypes.team:
      return <TeamTask {...props} />
    case todoTypes.folder:
      return <SwitchTabTask {...props} dismissTodoType="folder" tab={C.Tabs.fsTab} />
    case todoTypes.gitRepo:
      return <GitRepoTask {...props} />
    case todoTypes.legacyEmailVisibility:
      return <LegacyEmailVisibilityTask {...props} />
    case todoTypes.teamShowcase:
      return <SwitchTabTask {...props} dismissTodoType="teamShowcase" tab={C.Tabs.teamsTab} />
    case todoTypes.verifyAllEmail:
      return <VerifyAllEmailTask {...props} />
    case todoTypes.verifyAllPhoneNumber:
      return <VerifyAllPhoneNumberTask {...props} />
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
    icon={<Kb.IconAuto type={props.icon} />}
    buttons={props.buttons}
  >
    <Kb.Markdown style={styles.instructions}>{props.instructions}</Kb.Markdown>
    {!!props.subText && <Kb.Text type="BodySmall">{props.subText}</Kb.Text>}
  </PeopleItem>
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  instructions: {marginTop: 2},
}))

export default TaskChooser
