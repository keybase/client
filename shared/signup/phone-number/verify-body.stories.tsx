import type {Meta, StoryObj} from '@storybook/react'
import VerifyBody from './verify-body'

const meta: Meta<typeof VerifyBody> = {
  component: VerifyBody,
  title: 'Signup/PhoneNumberVerifyBody',
  args: {
    onChangeCode: () => {},
    onResend: () => {},
    resendWaiting: false,
  },
}
export default meta
type Story = StoryObj<typeof VerifyBody>

export const Empty: Story = {
  args: {
    code: '',
  },
}

export const Filled: Story = {
  args: {
    code: '123456',
  },
}

export const ResendWaiting: Story = {
  args: {
    code: '',
    resendWaiting: true,
  },
}
