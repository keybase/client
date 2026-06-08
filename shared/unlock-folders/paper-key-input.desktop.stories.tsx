import type {Meta, StoryObj} from '@storybook/react'
import PaperKeyInput from './paper-key-input.desktop'

const meta: Meta<typeof PaperKeyInput> = {
  component: PaperKeyInput,
  title: 'UnlockFolders/PaperKeyInput',
  args: {
    onBack: () => {},
    onContinue: () => {},
    waiting: false,
  },
}
export default meta
type Story = StoryObj<typeof PaperKeyInput>

export const Default: Story = {}

export const WithError: Story = {
  args: {
    paperkeyError: 'Incorrect paper key. Please try again.',
  },
}

export const Waiting: Story = {
  args: {
    waiting: true,
  },
}
