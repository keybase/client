import * as React from 'react'
import {storiesOf, action} from '../../stories/storybook'
import {Task} from '.'
import {Provider as SearchBarProvider} from '../../profile/search/index.stories'

const actionProps = {
  onConfirm: action('onConfirm'),
  onDismiss: action('onDismiss'),
} as const

const avatarTeamTaskProps = {
  badged: true,
  confirmLabel: 'Edit team avatar',
  dismissable: false,
  icon: 'icon-onboarding-team-avatar-32',
  instructions: 'NEW! Change your team’s avatar from within the Keybase app.',
  ...actionProps,
} as const

const avatarUserTaskProps = {
  badged: true,
  confirmLabel: 'Edit avatar',
  dismissable: false,
  icon: 'icon-onboarding-user-avatar-32',
  instructions: 'NEW! Change your photo from within the Keybase app.',
  ...actionProps,
} as const

const bioTaskProps = {
  badged: true,
  confirmLabel: 'Edit profile',
  dismissable: false,
  icon: 'icon-onboarding-user-info-32',
  instructions: 'Add your name, bio, and location to complete your profile.',
  ...actionProps,
} as const

const proofTaskProps = {
  badged: true,
  confirmLabel: 'Prove your identities',
  dismissable: true,
  icon: 'icon-onboarding-proofs-32',
  instructions:
    'Add some proofs to your profile. The more you have, the stronger your cryptographic identity.',
  ...actionProps,
} as const

const installTaskProps = {
  badged: true,
  confirmLabel: 'Get the download link',
  dismissable: true,
  icon: 'icon-onboarding-phone-32',
  instructions: 'Install Keybase on your phone. Until you have at least 2 devices, you risk losing data.',
  ...actionProps,
} as const

const followTaskProps = {
  badged: true,
  confirmLabel: 'Browse people',
  dismissable: true,
  icon: 'icon-onboarding-follow-32',
  instructions:
    'Follow at least one person on Keybase. A "follow" is a signed snapshot of someone. It strengthens Keybase and your own security.',
  ...actionProps,
} as const

const chatTaskProps = {
  badged: true,
  confirmLabel: 'Start a chat',
  dismissable: true,
  icon: 'icon-onboarding-chat-32',
  instructions: 'Start a chat! All conversations on Keybase are end-to-end encrypted.',
  ...actionProps,
} as const

const paperKeyTaskProps = {
  badged: true,
  confirmLabel: 'Create a paper key',
  dismissable: false,
  icon: 'icon-onboarding-paper-key-32',
  instructions:
    'Please make a paper key. Unlike your account password, paper keys can provision new devices and recover data, for ultimate safety.',
  ...actionProps,
} as const

const teamTaskProps = {
  badged: true,
  confirmLabel: 'Create a team',
  dismissable: true,
  icon: 'icon-onboarding-team-32',
  instructions:
    'Create a team! Keybase team chats are end-to-end encrypted - unlike Slack - and work for any kind of group, from casual friends to large communities.',
  ...actionProps,
} as const

const folderTaskProps = {
  badged: true,
  confirmLabel: 'Open a private folder',
  dismissable: true,
  icon: 'icon-onboarding-folder-32',
  instructions:
    'Open an encrypted private folder with someone! They’ll only get notified once you drop files in it.',
  ...actionProps,
} as const

const gitTaskProps = {
  badged: true,
  confirmLabel: 'Create a personal git repo',
  dismissable: true,
  icon: 'icon-onboarding-git-32',
  instructions:
    'Create an encrypted Git repository! Only you will be able to decrypt any of it. And it’s so easy!',
  ...actionProps,
} as const

const publicityTaskProps = {
  badged: true,
  confirmLabel: 'Set publicity settings',
  dismissable: true,
  icon: 'icon-onboarding-team-publicity-32',
  instructions: `Tip: Keybase team chats are private, but you can choose to publish that you're an admin. Check out “Publicity settings" on any team you manage.`,
  ...actionProps,
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
}

export default load
