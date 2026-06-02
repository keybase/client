import type {Meta, StoryObj} from '@storybook/react'
import GoButton from './go-button'

const meta: Meta<typeof GoButton> = {
  component: GoButton,
  title: 'TeamBuilding/GoButton',
  args: {
    label: 'Start',
    onClick: () => {},
  },
}
export default meta
type Story = StoryObj<typeof GoButton>

export const LabelStart: Story = {
  args: {label: 'Start'},
}

export const LabelAdd: Story = {
  args: {label: 'Add'},
}
