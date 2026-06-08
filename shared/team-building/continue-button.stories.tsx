import type {Meta, StoryObj} from '@storybook/react'
import ContinueButton from './continue-button'

const meta: Meta<typeof ContinueButton> = {
  component: ContinueButton,
  title: 'TeamBuilding/ContinueButton',
  args: {
    label: 'Continue',
    onClick: () => {},
    disabled: false,
  },
}
export default meta
type Story = StoryObj<typeof ContinueButton>

export const Enabled: Story = {
  args: {label: 'Continue', disabled: false},
}

export const Disabled: Story = {
  args: {label: 'Continue', disabled: true},
}

export const CustomLabel: Story = {
  args: {label: 'Add to team', disabled: false},
}
