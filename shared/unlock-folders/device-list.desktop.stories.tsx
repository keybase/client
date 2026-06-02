import type {Meta, StoryObj} from '@storybook/react'
import type {UnlockFolderDevice} from './store'
import DeviceList from './device-list.desktop'

const makeDevice = (overrides: Partial<UnlockFolderDevice> = {}): UnlockFolderDevice => ({
  deviceID: 'device-001' as UnlockFolderDevice['deviceID'],
  name: 'My Device',
  type: 'desktop',
  ...overrides,
})

const meta: Meta<typeof DeviceList> = {
  component: DeviceList,
  title: 'UnlockFolders/DeviceList',
  args: {
    toPaperKeyInput: () => {},
  },
}
export default meta
type Story = StoryObj<typeof DeviceList>

export const SingleDesktop: Story = {
  args: {
    devices: [makeDevice({name: 'work-laptop', type: 'desktop'})],
  },
}

export const MultipleDevices: Story = {
  args: {
    devices: [
      makeDevice({deviceID: 'd1' as UnlockFolderDevice['deviceID'], name: 'work-laptop', type: 'desktop'}),
      makeDevice({deviceID: 'd2' as UnlockFolderDevice['deviceID'], name: 'iPhone 15', type: 'mobile'}),
      makeDevice({deviceID: 'd3' as UnlockFolderDevice['deviceID'], name: 'Paper key', type: 'backup'}),
    ],
  },
}

export const MobileOnly: Story = {
  args: {
    devices: [makeDevice({name: 'iPhone 15', type: 'mobile'})],
  },
}

export const PaperKeyOnly: Story = {
  args: {
    devices: [makeDevice({name: 'My paper key backup', type: 'backup'})],
  },
}

export const ManyDevices: Story = {
  args: {
    devices: [
      makeDevice({deviceID: 'd1' as UnlockFolderDevice['deviceID'], name: 'home-desktop', type: 'desktop'}),
      makeDevice({deviceID: 'd2' as UnlockFolderDevice['deviceID'], name: 'work-laptop', type: 'desktop'}),
      makeDevice({deviceID: 'd3' as UnlockFolderDevice['deviceID'], name: 'iPhone 15', type: 'mobile'}),
      makeDevice({deviceID: 'd4' as UnlockFolderDevice['deviceID'], name: 'iPad Pro', type: 'mobile'}),
      makeDevice({deviceID: 'd5' as UnlockFolderDevice['deviceID'], name: 'Paper key alpha', type: 'backup'}),
      makeDevice({deviceID: 'd6' as UnlockFolderDevice['deviceID'], name: 'Paper key beta', type: 'backup'}),
    ],
  },
}
