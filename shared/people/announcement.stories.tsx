import type {Meta, StoryObj} from '@storybook/react'
import Announcement from './announcement'

const meta: Meta<typeof Announcement> = {
  component: Announcement,
  title: 'People/Announcement',
  args: {
    badged: false,
    dismissable: false,
    dismissAnnouncement: () => {},
    getData: () => {},
    id: 1 as any,
    text: 'Keybase has a new feature available.',
  },
}
export default meta
type Story = StoryObj<typeof Announcement>

export const Basic: Story = {
  args: {
    text: 'Keybase has a new feature available.',
    badged: false,
    dismissable: false,
  },
}

export const Badged: Story = {
  args: {
    text: 'Important update: please review your security settings.',
    badged: true,
    dismissable: false,
  },
}

export const WithConfirmButton: Story = {
  args: {
    text: 'You can now add your phone number for account recovery.',
    confirmLabel: 'Add phone',
    badged: false,
    dismissable: false,
  },
}

export const Dismissable: Story = {
  args: {
    text: 'Check out the new Keybase Teams feature.',
    confirmLabel: 'Learn more',
    badged: false,
    dismissable: true,
  },
}

export const WithIconUrl: Story = {
  args: {
    text: 'Your Keybase profile has been verified.',
    iconUrl: 'https://keybase.io/images/icons/icon-keybase-logo-48@2x.png',
    badged: false,
    dismissable: false,
  },
}

export const LongText: Story = {
  args: {
    text: 'Keybase now supports end-to-end encrypted git repositories for teams. All members of your team will be able to securely collaborate on code without exposing it to outside parties. Visit the Git tab to create your first team repository.',
    confirmLabel: 'Open Git',
    badged: true,
    dismissable: true,
  },
}
