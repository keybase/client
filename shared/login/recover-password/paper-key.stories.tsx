import type {Meta, StoryObj} from '@storybook/react'
import PaperKey from './paper-key'

const meta: Meta<typeof PaperKey> = {
  component: PaperKey,
  title: 'Login/RecoverPasswordPaperKey',
  args: {
    route: {params: {}},
  },
}
export default meta
type Story = StoryObj<typeof PaperKey>

export const Empty: Story = {
  args: {
    route: {params: {}},
  },
}

export const WithError: Story = {
  args: {
    route: {params: {error: 'Incorrect paper key. Please try again.'}},
  },
}
