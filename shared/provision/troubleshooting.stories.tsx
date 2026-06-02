import type {Meta, StoryObj} from '@storybook/react'
import Troubleshooting from './troubleshooting'

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
    mode: 'QR',
    otherDeviceType: 'desktop',
  },
}

export const TextMode: Story = {
  args: {
    mode: 'text',
    otherDeviceType: 'desktop',
  },
}

export const OtherDeviceMobile: Story = {
  args: {
    mode: 'QR',
    otherDeviceType: 'mobile',
  },
}
