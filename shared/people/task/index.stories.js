// @flow
import React from 'react'
import {storiesOf, action} from '../../stories/storybook'
import {Task, type Props} from '.'

const actionProps = {
  onConfirm: action('onConfirm'),
  onDismiss: action('onDismiss'),
}

const bioTaskProps: Props = {
  badged: true,
  confirmLabel: 'Edit profile',
  instructions: 'Add your name, bio, and location to complete your profile.',
  dismissable: false,
  icon: 'icon-onboarding-user-info-32',
  ...actionProps,
}

const proofTaskProps: Props = {
  badged: true,
  confirmLabel: 'Prove your identities',
  instructions:
    'Add some proofs to your profile. The more you have, the stronger your cryptographic identity.',
  dismissable: true,
  icon: 'icon-onboarding-proofs-32',
  ...actionProps,
}

const installTaskProps: Props = {
  badged: true,
  confirmLabel: 'Get the download link',
  instructions: 'Install Keybase on your phone. Until you have at least 2 devices, you risk losing data.',
  dismissable: true,
  icon: 'icon-onboarding-phone-32',
  ...actionProps,
}

const followTaskProps: Props = {
  badged: true,
  confirmLabel: 'Browse people',
  instructions:
    'Follow at least one person on Keybase. A "follow" is a signed snapshot of someone. It strengthens Keybase and your own security.',
  dismissable: true,
  icon: 'icon-onboarding-follow-32',
  ...actionProps,
}

const chatTaskProps: Props = {
  badged: true,
  confirmLabel: 'Start a chat',
  instructions: 'Start a chat! All conversations on Keybase are end-to-end encrypted.',
  dismissable: true,
  icon: 'icon-onboarding-chat-32',
  ...actionProps,
}

const paperKeyTaskProps: Props = {
  badged: true,
  confirmLabel: 'Create a paper key',
  instructions:
    'Please make a paper key. Unlike your account password, paper keys can provision new devices and recover data, for ultimate safety.',
  dismissable: false,
  icon: 'icon-onboarding-paper-key-32',
  ...actionProps,
}

const teamTaskProps: Props = {
  badged: true,
  confirmLabel: 'Create a team',
  instructions:
    'Create a team! Keybase team chats are end-to-end encrypted - unlike Slack - and work for any kind of group, from casual friends to large communities.',
  dismissable: true,
  icon: 'icon-onboarding-team-32',
  ...actionProps,
}

const folderTaskProps: Props = {
  badged: true,
  confirmLabel: 'Open a private folder',
  instructions:
    'Open an encrypted private folder with someone! They’ll only get notified once you drop files in it.',
  dismissable: true,
  icon: 'icon-onboarding-folder-32',
  ...actionProps,
}

const gitTaskProps: Props = {
  badged: true,
  confirmLabel: 'Create a personal git repo',
  instructions:
    'Create an encrypted Git repository! Only you will be able to decrypt any of it. And it’s so easy!',
  dismissable: true,
  icon: 'icon-onboarding-git-32',
  ...actionProps,
}

const publicityTaskProps: Props = {
  badged: true,
  confirmLabel: 'Set publicity settings',
  instructions: `Tip: Keybase team chats are private, but you can choose to publish that you're an admin. Check out “Publicity settings" on any team you manage.`,
  dismissable: true,
  icon: 'icon-onboarding-team-publicity-32',
  ...actionProps,
}

const load = () => {
  storiesOf('People/Todos', module)
    .add('Fill out bio', () => <Task {...bioTaskProps} />)
    .add('Prove something', () => <Task {...proofTaskProps} />)
    .add('Install on phone', () => <Task {...installTaskProps} />)
    .add('Follow someone', () => <Task {...followTaskProps} />)
    .add('Chat', () => <Task {...chatTaskProps} />)
    .add('Make a paper key', () => <Task {...paperKeyTaskProps} />)
    .add('Make a team', () => <Task {...teamTaskProps} />)
    .add('Make a folder', () => <Task {...folderTaskProps} />)
    .add('Make a git', () => <Task {...gitTaskProps} />)
    .add('Set publicity', () => <Task {...publicityTaskProps} />)
}

export default load
