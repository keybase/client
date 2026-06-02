import type {Meta, StoryObj} from '@storybook/react'
import Group from './group'

const meta: Meta<typeof Group> = {
  component: Group,
  title: 'Settings/Group',
  args: {
    allowEdit: true,
    groupName: 'email',
    onToggle: () => {},
    unsubscribedFromAll: false,
  },
}
export default meta
type Story = StoryObj<typeof Group>

export const WithSettings: Story = {
  args: {
    title: 'Email notifications',
    settings: [
      {description: 'When someone follows me', name: 'follow', subscribed: true},
      {description: 'When someone requests access to a team I manage', name: 'teamRequest', subscribed: false},
      {description: 'New team announcements', name: 'teamAnnounce', subscribed: true},
    ],
  },
}

export const WithUnsubscribeAll: Story = {
  args: {
    title: 'Email notifications',
    unsub: 'email',
    settings: [
      {description: 'When someone follows me', name: 'follow', subscribed: true},
      {description: 'New team announcements', name: 'teamAnnounce', subscribed: true},
    ],
    unsubscribedFromAll: false,
    onToggleUnsubscribeAll: () => {},
  },
}

export const UnsubscribedFromAll: Story = {
  args: {
    title: 'Email notifications',
    unsub: 'email',
    settings: [
      {description: 'When someone follows me', name: 'follow', subscribed: false},
      {description: 'New team announcements', name: 'teamAnnounce', subscribed: false},
    ],
    unsubscribedFromAll: true,
    onToggleUnsubscribeAll: () => {},
  },
}

export const Disabled: Story = {
  args: {
    allowEdit: false,
    title: 'Push notifications',
    label: 'Enable in your device settings first.',
    settings: [
      {description: 'New messages', name: 'chat', subscribed: false},
      {description: 'Someone follows you', name: 'follow', subscribed: false},
    ],
  },
}

export const NoSettings: Story = {
  args: {
    title: 'No items group',
  },
}
