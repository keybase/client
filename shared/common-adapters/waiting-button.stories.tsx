import type {Meta, StoryObj} from '@storybook/react'
import WaitingButton from './waiting-button'

const meta: Meta<typeof WaitingButton> = {
  component: WaitingButton,
  title: 'CommonAdapters/WaitingButton',
  args: {label: 'Submit', onClick: () => {}},
}
export default meta
type Story = StoryObj<typeof WaitingButton>

export const Default: Story = {
  args: {label: 'Submit', type: 'Default'},
}

export const Success: Story = {
  args: {label: 'Save', type: 'Success'},
}

export const Danger: Story = {
  args: {label: 'Delete', type: 'Danger'},
}

export const Disabled: Story = {
  args: {label: 'Submit', disabled: true},
}

export const Small: Story = {
  args: {label: 'OK', small: true},
}

export const FullWidth: Story = {
  args: {label: 'Continue', fullWidth: true},
}
