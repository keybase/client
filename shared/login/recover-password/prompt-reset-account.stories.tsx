import type {Meta, StoryObj} from '@storybook/react'
import PromptReset from './prompt-reset-shared'

const meta: Meta<typeof PromptReset> = {
  component: PromptReset,
  title: 'Login/RecoverPasswordPromptReset',
}
export default meta
type Story = StoryObj<typeof PromptReset>

export const AccountReset: Story = {
  args: {
    skipPassword: true,
    username: 'testuser',
  },
}

export const ResetPassword: Story = {
  args: {
    resetPassword: true,
    skipPassword: false,
    username: 'testuser',
  },
}

export const KnowPassword: Story = {
  args: {
    skipPassword: false,
    username: 'testuser',
  },
}
