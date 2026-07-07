import type {Meta, StoryObj} from '@storybook/react'
import RecoverPasswordError from './error'

const meta: Meta<typeof RecoverPasswordError> = {
  component: RecoverPasswordError,
  title: 'Login/RecoverPasswordError',
}
export default meta
type Story = StoryObj<typeof RecoverPasswordError>

export const GenericError: Story = {
  args: {
    route: {params: {error: 'An unexpected error occurred. Please try again.'}},
  },
}

export const NetworkError: Story = {
  args: {
    route: {params: {error: 'Network error: could not reach Keybase servers.'}},
  },
}
