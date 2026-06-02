import type {Meta, StoryObj} from '@storybook/react'
import type {NewFollow} from './follow-notification'
import FollowNotification from './follow-notification'

const now = new Date()
const hourAgo = new Date(now.getTime() - 60 * 60 * 1000)
const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

const makeFollow = (username: string, contactDescription?: string): NewFollow => ({
  username,
  ...(contactDescription ? {contactDescription} : {}),
})

const meta: Meta<typeof FollowNotification> = {
  component: FollowNotification,
  title: 'People/FollowNotification',
  args: {
    onClickUser: () => {},
    badged: false,
    notificationTime: hourAgo,
    type: 'follow',
    newFollows: [makeFollow('alice')],
  },
}
export default meta
type Story = StoryObj<typeof FollowNotification>

export const SingleFollow: Story = {
  args: {
    newFollows: [makeFollow('alice')],
    notificationTime: hourAgo,
    type: 'follow',
    badged: false,
  },
}

export const SingleFollowBadged: Story = {
  args: {
    newFollows: [makeFollow('bob')],
    notificationTime: now,
    type: 'follow',
    badged: true,
  },
}

export const SingleContact: Story = {
  args: {
    newFollows: [makeFollow('carol', 'Carol White (+1-555-0001)')],
    notificationTime: dayAgo,
    type: 'contact',
    badged: false,
  },
}

export const MultiFollow: Story = {
  args: {
    newFollows: [makeFollow('alice'), makeFollow('bob'), makeFollow('carol')],
    notificationTime: hourAgo,
    type: 'follow',
    badged: false,
  },
}

export const MultiFollowBadged: Story = {
  args: {
    newFollows: [makeFollow('dave'), makeFollow('eve')],
    notificationTime: now,
    type: 'follow',
    badged: true,
  },
}

export const MultiFollowWithAdditional: Story = {
  args: {
    newFollows: [makeFollow('frank'), makeFollow('grace'), makeFollow('heidi')],
    numAdditional: 7,
    notificationTime: dayAgo,
    type: 'follow',
    badged: false,
  },
}

export const MultiContact: Story = {
  args: {
    newFollows: [
      makeFollow('user1', 'Contact A (+1-555-0002)'),
      makeFollow('user2', 'Contact B (+1-555-0003)'),
    ],
    notificationTime: hourAgo,
    type: 'contact',
    badged: false,
  },
}
