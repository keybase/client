import type {Meta, StoryObj} from '@storybook/react'
import type * as T from '@/constants/types'
import DeviceIcon from './device-icon'

const makeDevice = (
  type: T.Devices.DeviceType,
  deviceNumberOfType: number = 0
): T.Devices.Device => ({
  created: Date.now(),
  currentDevice: false,
  deviceID: 'test-id',
  deviceNumberOfType,
  lastUsed: Date.now(),
  name: 'test device',
  type,
})

const meta: Meta<typeof DeviceIcon> = {
  component: DeviceIcon,
  title: 'Devices/DeviceIcon',
}
export default meta
type Story = StoryObj<typeof DeviceIcon>

export const DesktopSize32: Story = {
  args: {device: makeDevice('desktop', 0), size: 32},
}
export const DesktopSize32Current: Story = {
  args: {device: makeDevice('desktop', 0), size: 32, current: true},
}
export const DesktopSize64: Story = {
  args: {device: makeDevice('desktop', 1), size: 64},
}
export const MobileSize32: Story = {
  args: {device: makeDevice('mobile', 0), size: 32},
}
export const MobileSize64: Story = {
  args: {device: makeDevice('mobile', 0), size: 64},
}
export const PaperKeySize32: Story = {
  args: {device: makeDevice('backup', 0), size: 32},
}
export const PaperKeySize64: Story = {
  args: {device: makeDevice('backup', 0), size: 64},
}
