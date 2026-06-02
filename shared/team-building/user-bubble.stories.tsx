import type {Meta, StoryObj} from '@storybook/react'
import type * as T from '@/constants/types'
import UserBubble from './user-bubble'

const meta: Meta<typeof UserBubble> = {
  component: UserBubble,
  title: 'TeamBuilding/UserBubble',
  args: {
    username: 'testuser',
    service: 'keybase' as T.TB.ServiceIdWithContact,
    tooltip: 'testuser',
    onRemove: () => {},
  },
}
export default meta
type Story = StoryObj<typeof UserBubble>

export const KeybaseUser: Story = {
  args: {
    username: 'testuser',
    service: 'keybase',
    tooltip: 'testuser',
  },
}

export const TwitterUser: Story = {
  args: {
    username: 'twitteruser',
    service: 'twitter' as T.TB.ServiceIdWithContact,
    tooltip: 'twitteruser@twitter',
  },
}

export const GitHubUser: Story = {
  args: {
    username: 'githubuser',
    service: 'github' as T.TB.ServiceIdWithContact,
    tooltip: 'githubuser@github',
  },
}

export const PhoneContact: Story = {
  args: {
    // E164 format without leading '+'
    username: '15551234567',
    service: 'phone' as T.TB.ServiceIdWithContact,
    tooltip: '+1 (555) 123-4567',
  },
}

export const EmailContact: Story = {
  args: {
    username: 'user@example.com',
    service: 'email' as T.TB.ServiceIdWithContact,
    tooltip: 'user@example.com',
  },
}
