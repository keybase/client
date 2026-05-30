import * as C from '@/constants'
import * as React from 'react'
import {editAvatar, openURL} from '@/util/misc'
import type * as T from '@/constants/types'
import type {IconType} from '@/common-adapters/icon.constants-gen'
import PeopleItem, {type TaskButton} from './item'
import * as Kb from '@/common-adapters'
import {useSettingsEmailState} from '@/stores/settings-email'
import {settingsAccountTab, settingsGitTab} from '@/constants/settings'
import type {AppTab} from '@/constants/tabs'
import {useCurrentUserState} from '@/stores/current-user'
import {navToProfile} from '@/constants/router'
import {makeNewTeamWizard} from '@/teams/new-team/wizard/state'


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
  if (type) {
    skipTodo(type)
  }
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
  const {navigateAppend, switchTab} = C.Router2
  const onConfirm = () => {
    switchTab(C.Tabs.settingsTab)
    navigateAppend({name: settingsAccountTab, params: {}})
    if (destination) {
      navigateAppend({name: destination, params: {}})
    }
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
  const onConfirm = () => {
    navToProfile(myUsername)
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
  <BasicTask {...props} dismissTodoType={dismissTodoType} onConfirm={() => { void openURL(url) }} />
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
  return (
    <BasicTask
      {...props}
      dismissTodoType="team"
      onConfirm={() => {
        C.Router2.switchTab(C.Tabs.teamsTab)
        C.Router2.navigateAppend({name: 'teamWizard1TeamPurpose', params: {wizard: makeNewTeamWizard()}})
      }}
    />
  )
}

const GitRepoTask = (props: TodoOwnProps) => {
  const {navigateAppend, switchTab} = C.Router2
  const onConfirm = (isTeam: boolean) => {
    if (isMobile) {
      navigateAppend({name: settingsGitTab, params: {}})
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
    editEmail({email, onSuccess: () => props.setResentEmail(email), verify: true})
  }
  const {navigateAppend, switchTab} = C.Router2
  const onManage = () => {
    switchTab(C.Tabs.settingsTab)
    navigateAppend({name: settingsAccountTab, params: {}})
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
  const {navigateAppend, switchTab} = C.Router2
  const onConfirm = (phoneNumber: string) => {
    navigateAppend({name: 'settingsVerifyPhone', params: {initialResend: true, phoneNumber}})
  }
  const onManage = () => {
    switchTab(C.Tabs.settingsTab)
    navigateAppend({name: settingsAccountTab, params: {}})
  }
  const buttons: Array<TaskButton> = [
    ...(props.metadata
      ? [
          {
            label: 'Verify',
            onClick: () => {
              const meta = props.metadata
              if (meta?.type === 'phone') {
                onConfirm(meta.phone)
              }
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
  const {navigateAppend, switchTab} = C.Router2
  const onConfirm = (email: string) => {
    switchTab(C.Tabs.settingsTab)
    navigateAppend({name: settingsAccountTab, params: {}})
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
              if (meta?.type === 'email') {
                onConfirm(meta.email)
              }
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
    case 'addEmail':
      return <SettingsAccountTask {...props} dismissTodoType="addEmail" destination="settingsAddEmail" />
    case 'addPhoneNumber':
      return (
        <SettingsAccountTask {...props} dismissTodoType="addPhoneNumber" destination="settingsAddPhone" />
      )
    case 'avatarTeam':
      return <SwitchTabTask {...props} tab={C.Tabs.teamsTab} />
    case 'avatarUser':
      return <AvatarUserTask {...props} />
    case 'bio':
      return <BioTask {...props} />
    case 'proof':
      return <ProofTask {...props} />
    case 'device':
      return <OpenURLTask {...props} dismissTodoType="device" url={installLinkURL} />
    case 'follow':
      return <FollowTask {...props} />
    case 'chat':
      return <SwitchTabTask {...props} dismissTodoType="chat" tab={C.Tabs.chatTab} />
    case 'paperkey':
      return <PaperKeyTask {...props} />
    case 'team':
      return <TeamTask {...props} />
    case 'folder':
      return <SwitchTabTask {...props} dismissTodoType="folder" tab={C.Tabs.fsTab} />
    case 'gitRepo':
      return <GitRepoTask {...props} />
    case 'legacyEmailVisibility':
      return <LegacyEmailVisibilityTask {...props} />
    case 'teamShowcase':
      return <SwitchTabTask {...props} dismissTodoType="teamShowcase" tab={C.Tabs.teamsTab} />
    case 'verifyAllEmail':
      return <VerifyAllEmailTask {...props} />
    case 'verifyAllPhoneNumber':
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
