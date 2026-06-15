import type {Meta, StoryObj} from '@storybook/react'
import Troubleshooting from './troubleshooting'
import type {Device} from '@/constants/provision'

const makeDevice = (overrides: Partial<Device> = {}): Device => ({
  deviceNumberOfType: 0,
  id: 'device-001' as Device['id'],
  name: 'testuser-mac',
  type: 'desktop',
  ...overrides,
})

const meta: Meta<typeof Troubleshooting> = {
  component: Troubleshooting,
  title: 'Provision/Troubleshooting',
  args: {
    onCancel: () => {},
  },
}
export default meta
type Story = StoryObj<typeof Troubleshooting>

export const QRMode: Story = {
  args: {
    device: makeDevice(),
    mode: 'QR',
  },
}

export const TextMode: Story = {
  args: {
    device: makeDevice(),
    mode: 'text',
  },
}

export const OtherDeviceMobile: Story = {
  args: {
    device: makeDevice({name: 'iPhone 15', type: 'mobile'}),
    mode: 'QR',
  },
}
