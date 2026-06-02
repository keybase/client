import type {Meta, StoryObj} from '@storybook/react'
import * as T from '@/constants/types'
import ExplainDevice from './explain-device'

const meta: Meta<typeof ExplainDevice> = {
  component: ExplainDevice,
  title: 'Login/RecoverPasswordExplainDevice',
}
export default meta
type Story = StoryObj<typeof ExplainDevice>

export const Desktop: Story = {
  args: {
    route: {
      params: {
        deviceName: 'work-laptop',
        deviceType: T.RPCGen.DeviceType.desktop,
        username: 'testuser',
      },
    },
  },
}

export const Mobile: Story = {
  args: {
    route: {
      params: {
        deviceName: 'iPhone 15',
        deviceType: T.RPCGen.DeviceType.mobile,
        username: 'testuser',
      },
    },
  },
}
