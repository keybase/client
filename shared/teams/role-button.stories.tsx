import type {Meta, StoryObj} from '@storybook/react'
import RoleButton from './role-button'

const meta: Meta<typeof RoleButton> = {
  component: RoleButton,
  title: 'Teams/RoleButton',
  args: {
    selectedRole: 'reader',
    onClick: () => {},
  },
}
export default meta
type Story = StoryObj<typeof RoleButton>

export const Reader: Story = {
  args: {selectedRole: 'reader'},
}

export const Writer: Story = {
  args: {selectedRole: 'writer'},
}

export const Admin: Story = {
  args: {selectedRole: 'admin'},
}

export const Owner: Story = {
  args: {selectedRole: 'owner'},
}

export const Bot: Story = {
  args: {selectedRole: 'bot'},
}

export const Loading: Story = {
  args: {selectedRole: 'admin', loading: true},
}
