import type {Meta, StoryObj} from '@storybook/react'
import {PaperKey} from './paper-key'

const meta: Meta<typeof PaperKey> = {
  component: PaperKey,
  title: 'Provision/PaperKey',
  args: {
    hint: 'chrisnojima-mac...',
    error: '',
    waiting: false,
    onSubmit: () => {},
  },
}
export default meta
type Story = StoryObj<typeof PaperKey>

export const Empty: Story = {}

export const WithHint: Story = {
  args: {
    hint: 'family laptop...',
  },
}

export const WithError: Story = {
  args: {
    error: 'Incorrect paper key. Please try again.',
  },
}

export const Waiting: Story = {
  args: {
    waiting: true,
  },
}
