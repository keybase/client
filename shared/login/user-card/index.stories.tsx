import type {Meta, StoryObj} from '@storybook/react'
import * as Kb from '@/common-adapters'
import UserCard from './index'

const meta: Meta<typeof UserCard> = {
  component: UserCard,
  title: 'Login/UserCard',
}
export default meta
type Story = StoryObj<typeof UserCard>

export const WithUsername: Story = {
  args: {
    username: 'chrisnojima',
    children: (
      <Kb.Text type="Body" center={true}>
        Card content here
      </Kb.Text>
    ),
  },
}

export const WithoutUsername: Story = {
  args: {
    children: (
      <Kb.Text type="Body" center={true}>
        No username yet
      </Kb.Text>
    ),
  },
}

export const LargeAvatar: Story = {
  args: {
    username: 'chrisnojima',
    avatarSize: 128,
    children: (
      <Kb.Text type="Body" center={true}>
        Large avatar
      </Kb.Text>
    ),
  },
}

export const SmallAvatar: Story = {
  args: {
    username: 'chrisnojima',
    avatarSize: 48,
    children: (
      <Kb.Text type="Body" center={true}>
        Small avatar
      </Kb.Text>
    ),
  },
}
