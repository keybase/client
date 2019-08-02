import * as React from 'react'
import {storiesOf, action} from '../../stories/storybook'
import {Task, TaskButton} from '.'
import {Provider as SearchBarProvider} from '../../profile/search/index.stories'

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
  icon: 'icon-onboarding-team-avatar-48',
  instructions: 'NEW! Change your team’s avatar from within the Keybase app.',
} as const

const avatarUserTaskProps = {
  badged: true,
  buttons: defaultButtons('Edit avatar'),
  icon: 'icon-onboarding-user-avatar-48',
  instructions: 'NEW! Change your photo from within the Keybase app.',
} as const

const bioTaskProps = {
  badged: true,
  buttons: defaultButtons('Edit profile'),
  icon: 'icon-onboarding-user-info-48',
  instructions: 'Add your name, bio, and location to complete your profile.',
} as const

const proofTaskProps = {
  badged: true,
  buttons: defaultButtons('Prove your identities', 'Later'),
  icon: 'icon-onboarding-proofs-48',
  instructions:
    'Add some proofs to your profile. The more you have, the stronger your cryptographic identity.',
} as const

const installTaskProps = {
  badged: true,
  buttons: defaultButtons('Get the download link', 'Later'),
  icon: 'icon-onboarding-phone-48',
  instructions: 'Install Keybase on your phone. Until you have at least 2 devices, you risk losing data.',
} as const

const followTaskProps = {
  badged: true,
  buttons: [
    {
      label: 'Follow later',
      mode: 'Secondary',
      onClick: action('onDismiss'),
    },
  ] as Array<TaskButton>,
  icon: 'icon-onboarding-follow-48',
  instructions:
    'Follow at least one person on Keybase. A "follow" is a signed snapshot of someone. It strengthens Keybase and your own security.',
} as const

const chatTaskProps = {
  badged: true,
  buttons: defaultButtons('Start a chat', 'Later'),
  icon: 'icon-onboarding-chat-48',
  instructions: 'Start a chat! All conversations on Keybase are end-to-end encrypted.',
} as const

const paperKeyTaskProps = {
  badged: true,
  buttons: defaultButtons('Create a paper key'),
  icon: 'icon-onboarding-paper-key-48',
  instructions:
    'Please make a paper key. Unlike your account password, paper keys can provision new devices and recover data, for ultimate safety.',
} as const

const teamTaskProps = {
  badged: true,
  buttons: defaultButtons('Create a team', 'Later'),
  icon: 'icon-onboarding-team-48',
  instructions:
    'Create a team! Keybase team chats are end-to-end encrypted - unlike Slack - and work for any kind of group, from casual friends to large communities.',
} as const

const folderTaskProps = {
  badged: true,
  buttons: defaultButtons('Open a private folder', 'Later'),
  icon: 'icon-onboarding-folder-48',
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
      label: 'Later',
      mode: 'Secondary',
      onClick: action('onDismiss'),
    },
  ] as Array<TaskButton>,
  icon: 'icon-onboarding-git-48',
  instructions:
    'Create an encrypted Git repository! Only you (and teammates) will be able to decrypt any of it. And it’s so easy!',
} as const

const publicityTaskProps = {
  badged: true,
  buttons: defaultButtons('Set publicity settings', 'Later'),
  icon: 'icon-onboarding-team-publicity-48',
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
  icon: 'icon-onboarding-email-verify-48',
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
  icon: 'icon-onboarding-number-verify-48',
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
  icon: 'icon-onboarding-email-searchable-48',
  instructions: `Allow friends to find you using *test@example.com*`,
  subText: 'Your email will never appear on your public profile.',
} as const

const load = () => {
  storiesOf('People/Todos', module)
    .addDecorator(SearchBarProvider)
    .add('Edit team avatar', () => <Task {...avatarTeamTaskProps} />)
    .add('Edit avatar', () => <Task {...avatarUserTaskProps} />)
    .add('Fill out bio', () => <Task {...bioTaskProps} />)
    .add('Prove something', () => <Task {...proofTaskProps} />)
    .add('Install on phone', () => <Task {...installTaskProps} />)
    .add('Follow someone', () => <Task {...followTaskProps} />)
    .add('Follow someone with search', () => <Task {...followTaskProps} showSearchBar={true} />)
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
