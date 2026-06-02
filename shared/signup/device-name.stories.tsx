import type {Meta, StoryObj} from '@storybook/react'
import ConnectedEnterDevicename from './device-name'

// ConnectedEnterDevicename reads inviteCode/username from route.params and manages
// its own local state. The RPC calls are triggered by user interaction only.
const meta: Meta<typeof ConnectedEnterDevicename> = {
  component: ConnectedEnterDevicename,
  title: 'Signup/EnterDevicename',
  args: {
    route: {params: {}},
  },
}
export default meta
type Story = StoryObj<typeof ConnectedEnterDevicename>

export const Empty: Story = {
  args: {
    route: {params: {}},
  },
}

export const WithUsername: Story = {
  args: {
    route: {params: {username: 'testuser', inviteCode: 'abc123'}},
  },
}
