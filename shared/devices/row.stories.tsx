import type {Meta, StoryObj} from '@storybook/react'
import type * as T from '@/constants/types'
import DeviceRow, {BadgedDeviceIDsContext} from './row'

const now = Date.now()
const weekAgo = now - 7 * 24 * 60 * 60 * 1000

const makeDevice = (overrides: Partial<T.Devices.Device> = {}): T.Devices.Device => ({
  created: weekAgo,
  currentDevice: false,
  deviceID: 'device-001',
  deviceNumberOfType: 0,
  lastUsed: weekAgo,
  name: 'My Device',
  type: 'desktop',
  ...overrides,
})

const meta: Meta<typeof DeviceRow> = {
  component: DeviceRow,
  title: 'Devices/DeviceRow',
  args: {
    canRevoke: true,
    firstItem: true,
  },
}
export default meta
type Story = StoryObj<typeof DeviceRow>

export const DesktopCurrent: Story = {
  args: {
    device: makeDevice({name: 'testuser-mac', currentDevice: true}),
  },
}

export const DesktopActive: Story = {
  args: {
    device: makeDevice({name: 'work-laptop', currentDevice: false}),
    firstItem: false,
  },
}

export const MobileActive: Story = {
  args: {
    device: makeDevice({name: 'iPhone 15', type: 'mobile'}),
    firstItem: false,
  },
}

export const PaperKey: Story = {
  args: {
    device: makeDevice({name: 'Paper key', type: 'backup'}),
    firstItem: false,
  },
}

export const Revoked: Story = {
  args: {
    device: makeDevice({
      name: 'old-laptop',
      revokedAt: weekAgo,
      revokedByName: 'testuser-mac',
    }),
    firstItem: false,
  },
}

export const NewBadge: Story = {
  decorators: [
    Story => (
      <BadgedDeviceIDsContext value={new Set(['device-new'])}>
        <Story />
      </BadgedDeviceIDsContext>
    ),
  ],
  args: {
    device: makeDevice({name: 'new-phone', type: 'mobile', deviceID: 'device-new'}),
    firstItem: false,
  },
}
