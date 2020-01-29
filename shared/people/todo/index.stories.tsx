import * as React from 'react'
import {storiesOf, action} from '../../stories/storybook'
import {Task} from '.'
import {TaskButton} from '../item'
import * as Kb from '../../common-adapters'

const defaultButtons = (label, dismissLabel?) => {
  const ret = [
    {
      label: label,
      onClick: action('onConfirm'),
    },
  ] as Array<TaskButton>
  if (dismissLabel) {
    ret.push({
      label: dismissLabel,
      mode: 'Secondary',
      onClick: action('onDismiss'),
    })
  }
  return ret
}

const avatarTeamTaskProps = {
  badged: true,
  buttons: defaultButtons('Edit team avatar'),
  icon: Kb.IconType.icon_onboarding_team_avatar_48,
  instructions: 'Change your team’s avatar from within the Keybase app.',
} as const

const avatarUserTaskProps = {
  badged: true,
  buttons: defaultButtons('Edit avatar'),
  icon: Kb.IconType.icon_onboarding_user_avatar_48,
  instructions: 'Change your photo from within the Keybase app.',
} as const

const bioTaskProps = {
  badged: true,
  buttons: defaultButtons('Edit profile'),
  icon: Kb.IconType.icon_onboarding_user_info_48,
  instructions: 'Add your name, bio, and location to complete your profile.',
} as const

const proofTaskProps = {
  badged: true,
  buttons: defaultButtons('Prove your identities', 'Skip'),
  icon: Kb.IconType.icon_onboarding_proofs_48,
  instructions:
    'Add some proofs to your profile. The more you have, the stronger your cryptographic identity.',
} as const

const installTaskProps = {
  badged: true,
  buttons: defaultButtons('Get the download link', 'Skip'),
  icon: Kb.IconType.icon_onboarding_phone_48,
  instructions: 'Install Keybase on your phone. Until you have at least 2 devices, you risk losing data.',
} as const

const followTaskProps = {
  badged: true,
  buttons: [
    {
      label: 'Skip',
      mode: 'Secondary',
      onClick: action('onDismiss'),
    },
  ] as Array<TaskButton>,
  icon: Kb.IconType.icon_onboarding_follow_48,
  instructions:
    'Follow at least one person on Keybase. A "follow" is a signed snapshot of someone. It strengthens Keybase and your own security.',
} as const

const chatTaskProps = {
  badged: true,
  buttons: defaultButtons('Start a chat', 'Skip'),
  icon: Kb.IconType.icon_onboarding_chat_48,
  instructions: 'Start a chat! All conversations on Keybase are end-to-end encrypted.',
} as const

const paperKeyTaskProps = {
  badged: true,
  buttons: defaultButtons('Create a paper key'),
  icon: Kb.IconType.icon_onboarding_paper_key_48,
  instructions:
    'Please make a paper key. Unlike your account password, paper keys can provision new devices and recover data, for ultimate safety.',
} as const

const teamTaskProps = {
  badged: true,
  buttons: defaultButtons('Create a team', 'Skip'),
  icon: Kb.IconType.icon_onboarding_team_48,
  instructions:
    'Create a team! Keybase team chats are end-to-end encrypted - unlike Slack - and work for any kind of group, from casual friends to large communities.',
} as const

const folderTaskProps = {
  badged: true,
  buttons: defaultButtons('Open a private folder', 'Skip'),
  icon: Kb.IconType.icon_onboarding_folder_48,
  instructions:
    'Open an encrypted private folder with someone! They’ll only get notified once you drop files in it.',
} as const

const gitTaskProps = {
  badged: true,
  buttons: [
    {
      label: 'Create a personal repo',
      onClick: action('onPersonalRepo'),
    },
    {
      label: 'Create a team repo',
      onClick: action('onTeamRepo'),
    },
    {
      label: 'Skip',
      mode: 'Secondary',
      onClick: action('onDismiss'),
    },
  ] as Array<TaskButton>,
  icon: Kb.IconType.icon_onboarding_git_48,
  instructions:
    'Create an encrypted Git repository! Only you (and teammates) will be able to decrypt any of it. And it’s so easy!',
} as const

const publicityTaskProps = {
  badged: true,
  buttons: defaultButtons('Set publicity settings', 'Skip'),
  icon: Kb.IconType.icon_onboarding_team_publicity_48,
  instructions: `Tip: Keybase team chats are private, but you can choose to publish that you're an admin. Check out “Publicity settings" on any team you manage.`,
} as const

const verifyEmailProps = {
  badged: true,
  buttons: [
    {
      label: 'Verify',
      onClick: action('onConfirm'),
      type: 'Success',
    },
    {
      label: 'Manage emails',
      mode: 'Secondary',
      onClick: action('onManage'),
    },
  ] as Array<TaskButton>,
  icon: Kb.IconType.icon_onboarding_email_verify_48,
  instructions: `Your email address *test@example.com* is unverified.`,
} as const

const verifyPhoneNumberProps = {
  badged: true,
  buttons: [
    {
      label: 'Verify',
      onClick: action('onConfirm'),
      type: 'Success',
    },
    {
      label: 'Manage numbers',
      mode: 'Secondary',
      onClick: action('onManage'),
    },
  ] as Array<TaskButton>,
  icon: Kb.IconType.icon_onboarding_number_verify_48,
  instructions: `Your number *+1555000111* is unverified.`,
} as const

const legacyEmailVisibilityProps = {
  badged: true,
  buttons: [
    {
      label: 'Make searchable',
      onClick: action('onConfirm'),
      type: 'Success',
    },
    {
      label: 'No',
      mode: 'Secondary',
      onClick: action('onDismiss'),
    },
  ] as Array<TaskButton>,
  icon: Kb.IconType.icon_onboarding_email_searchable_48,
  instructions: `Allow friends to find you using *test@example.com*`,
  subText: 'Your email will never appear on your public profile.',
} as const

const load = () => {
  storiesOf('People/Todos', module)
    .add('Edit team avatar', () => <Task {...avatarTeamTaskProps} />)
    .add('Edit avatar', () => <Task {...avatarUserTaskProps} />)
    .add('Fill out bio', () => <Task {...bioTaskProps} />)
    .add('Prove something', () => <Task {...proofTaskProps} />)
    .add('Install on phone', () => <Task {...installTaskProps} />)
    .add('Follow people', () => <Task {...followTaskProps} />)
    .add('Chat', () => <Task {...chatTaskProps} />)
    .add('Make a paper key', () => <Task {...paperKeyTaskProps} />)
    .add('Make a team', () => <Task {...teamTaskProps} />)
    .add('Make a folder', () => <Task {...folderTaskProps} />)
    .add('Make a git', () => <Task {...gitTaskProps} />)
    .add('Set publicity', () => <Task {...publicityTaskProps} />)
    .add('Verify phone number', () => <Task {...verifyPhoneNumberProps} />)
    .add('Verify email', () => <Task {...verifyEmailProps} />)
    .add('Legacy email discoverability', () => <Task {...legacyEmailVisibilityProps} />)
}

export default load
