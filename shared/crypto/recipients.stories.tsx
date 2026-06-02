import type {Meta, StoryObj} from '@storybook/react'
import Recipients from './recipients'

const meta: Meta<typeof Recipients> = {
  component: Recipients,
  title: 'Crypto/Recipients',
  args: {
    inProgress: false,
    onAddRecipients: () => {},
    onClearRecipients: () => {},
    recipients: [],
  },
}
export default meta
type Story = StoryObj<typeof Recipients>

export const Empty: Story = {}

export const OneRecipient: Story = {
  args: {
    recipients: ['alice'],
  },
}

export const MultipleRecipients: Story = {
  args: {
    recipients: ['alice', 'bob', 'charlie'],
  },
}

export const InProgress: Story = {
  args: {
    recipients: ['alice', 'bob'],
    inProgress: true,
  },
}
