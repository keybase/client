import type {Meta, StoryObj} from '@storybook/react'
import type * as T from '@/constants/types'
import DevicePage from './device-page'

const now = Date.now()
const monthAgo = now - 30 * 24 * 60 * 60 * 1000
const weekAgo = now - 7 * 24 * 60 * 60 * 1000
const yearAgo = now - 365 * 24 * 60 * 60 * 1000

const makeDevice = (overrides: Partial<T.Devices.Device> = {}): T.Devices.Device => ({
  created: yearAgo,
  currentDevice: false,
  deviceID: 'device-001',
  deviceNumberOfType: 0,
  lastUsed: weekAgo,
  name: 'My Device',
  type: 'desktop',
  provisionerName: 'testuser-mac',
  ...overrides,
})

const meta: Meta<typeof DevicePage> = {
  component: DevicePage,
  title: 'Devices/DevicePage',
  args: {canRevoke: true},
}
export default meta
type Story = StoryObj<typeof DevicePage>

export const DesktopActive: Story = {
  args: {
    device: makeDevice({name: 'work-laptop', currentDevice: false}),
    canRevoke: true,
  },
}

export const CurrentDevice: Story = {
  args: {
    device: makeDevice({name: 'testuser-mac', currentDevice: true, lastUsed: now}),
    canRevoke: false,
  },
}

export const LastDevice: Story = {
  args: {
    device: makeDevice({name: 'only-device', currentDevice: true}),
    canRevoke: false,
  },
}

export const MobileDevice: Story = {
  args: {
    device: makeDevice({name: 'iPhone 15', type: 'mobile', deviceNumberOfType: 1}),
    canRevoke: true,
  },
}

export const PaperKey: Story = {
  args: {
    device: makeDevice({name: 'My paper key', type: 'backup', created: monthAgo}),
    canRevoke: true,
  },
}

export const RevokedDevice: Story = {
  args: {
    device: makeDevice({
      name: 'old-laptop',
      revokedAt: monthAgo,
      revokedByName: 'testuser-mac',
      lastUsed: monthAgo,
    }),
    canRevoke: false,
  },
}
