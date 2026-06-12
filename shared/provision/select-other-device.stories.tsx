import type {Meta, StoryObj} from '@storybook/react'
import SelectOtherDevice from './select-other-device'
import type {Device} from '@/constants/provision'

const makeDevice = (overrides: Partial<Device> = {}): Device => ({
  deviceNumberOfType: 0,
  id: 'device-001' as Device['id'],
  name: 'My Device',
  type: 'desktop',
  ...overrides,
})

const meta: Meta<typeof SelectOtherDevice> = {
  component: SelectOtherDevice,
  title: 'Provision/SelectOtherDevice',
  args: {
    onBack: () => {},
    onSelect: () => {},
    onResetAccount: () => {},
  },
}
export default meta
type Story = StoryObj<typeof SelectOtherDevice>

export const MultipleDevices: Story = {
  args: {
    devices: [
      makeDevice({name: 'work-laptop', type: 'desktop', deviceNumberOfType: 0}),
      makeDevice({name: 'iPhone 15', type: 'mobile', deviceNumberOfType: 1, id: 'device-002' as Device['id']}),
      makeDevice({name: 'Paper key', type: 'backup', deviceNumberOfType: 0, id: 'device-003' as Device['id']}),
    ],
  },
}

export const SingleDesktop: Story = {
  args: {
    devices: [makeDevice({name: 'work-laptop', type: 'desktop'})],
  },
}

export const PasswordRecovery: Story = {
  args: {
    passwordRecovery: true,
    devices: [
      makeDevice({name: 'work-laptop', type: 'desktop'}),
      makeDevice({name: 'iPhone 15', type: 'mobile', id: 'device-002' as Device['id']}),
    ],
  },
}

export const Empty: Story = {
  args: {
    devices: [],
  },
}
