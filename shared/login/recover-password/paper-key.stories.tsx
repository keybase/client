import type {Meta, StoryObj} from '@storybook/react'
import PaperKey from './paper-key'

const meta: Meta<typeof PaperKey> = {
  component: PaperKey,
  title: 'Login/RecoverPasswordPaperKey',
  args: {
    route: {params: {promptId: 0, runId: 0}},
  },
}
export default meta
type Story = StoryObj<typeof PaperKey>

export const Empty: Story = {
  args: {
    route: {params: {promptId: 0, runId: 0}},
  },
}

export const WithError: Story = {
  args: {
    route: {params: {error: 'Incorrect paper key. Please try again.', promptId: 0, runId: 0}},
  },
}
