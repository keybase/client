import type {Meta, StoryObj} from '@storybook/react'
import ConnectedError from './error'

const meta: Meta<typeof ConnectedError> = {
  component: ConnectedError,
  title: 'Login/RecoverPasswordError',
}
export default meta
type Story = StoryObj<typeof ConnectedError>

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
