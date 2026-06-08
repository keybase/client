import type {Meta, StoryObj} from '@storybook/react'
import SwitchToggle from './switch-toggle'

const meta: Meta<typeof SwitchToggle> = {
  component: SwitchToggle,
  title: 'CommonAdapters/SwitchToggle',
  args: {color: 'green', on: false},
}
export default meta
type Story = StoryObj<typeof SwitchToggle>

export const GreenOff: Story = {
  args: {color: 'green', on: false},
}

export const GreenOn: Story = {
  args: {color: 'green', on: true},
}

export const BlueOn: Story = {
  args: {color: 'blue', on: true},
}

export const RedOn: Story = {
  args: {color: 'red', on: true},
}
