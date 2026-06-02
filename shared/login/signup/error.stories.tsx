import type {Meta, StoryObj} from '@storybook/react'
import ConnectedSignupError from './error'

const meta: Meta<typeof ConnectedSignupError> = {
  component: ConnectedSignupError,
  title: 'Login/SignupError',
}
export default meta
type Story = StoryObj<typeof ConnectedSignupError>

export const GenericError: Story = {
  args: {
    route: {params: {errorMessage: 'An unexpected error occurred. Please try again.'}},
  },
}

export const NetworkError: Story = {
  args: {
    // errorCode 8 is scapinetworkerror
    route: {params: {errorCode: 8, errorMessage: 'Network error.'}},
  },
}

export const NoMessage: Story = {
  args: {
    route: {params: {}},
  },
}
