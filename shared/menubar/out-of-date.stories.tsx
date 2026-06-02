import type {Meta, StoryObj} from '@storybook/react'
import type * as T from '@/constants/types'
import OutOfDate from './out-of-date'

const makeOutOfDate = (overrides: Partial<T.Config.OutOfDate> = {}): T.Config.OutOfDate => ({
  critical: false,
  message: '',
  outOfDate: true,
  updating: false,
  ...overrides,
})

const meta: Meta<typeof OutOfDate> = {
  component: OutOfDate,
  title: 'Menubar/OutOfDate',
}
export default meta
type Story = StoryObj<typeof OutOfDate>

export const NonCritical: Story = {
  args: {
    outOfDate: makeOutOfDate(),
  },
}

export const Critical: Story = {
  args: {
    outOfDate: makeOutOfDate({critical: true}),
  },
}

export const NonCriticalWithMessage: Story = {
  args: {
    outOfDate: makeOutOfDate({message: 'Please update to get the latest security fixes'}),
  },
}

export const CriticalWithMessage: Story = {
  args: {
    outOfDate: makeOutOfDate({critical: true, message: 'Critical security patch required'}),
  },
}

export const Updating: Story = {
  args: {
    outOfDate: makeOutOfDate({updating: true}),
  },
}

export const CriticalUpdating: Story = {
  args: {
    outOfDate: makeOutOfDate({critical: true, updating: true}),
  },
}
