import type {Meta, StoryObj} from '@storybook/react'
import ConnectedEnterUsername from './username'

// ConnectedEnterUsername reads inviteCode/username from route.params and manages
// its own local state. RPC calls are triggered by user interaction only.
const meta: Meta<typeof ConnectedEnterUsername> = {
  component: ConnectedEnterUsername,
  title: 'Signup/EnterUsername',
  args: {
    route: {params: {}},
  },
}
export default meta
type Story = StoryObj<typeof ConnectedEnterUsername>

export const Empty: Story = {
  args: {
    route: {params: {}},
  },
}

export const Prefilled: Story = {
  args: {
    route: {params: {username: 'chrisnojima'}},
  },
}
