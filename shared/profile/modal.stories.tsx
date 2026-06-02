import type {Meta, StoryObj} from '@storybook/react'
import * as Kb from '@/common-adapters'
import Modal from './modal'

const meta: Meta<typeof Modal> = {
  component: Modal,
  title: 'Profile/Modal',
}
export default meta
type Story = StoryObj<typeof Modal>

export const WithCancelButton: Story = {
  args: {
    children: <Kb.Text type="Body">Modal content goes here.</Kb.Text>,
    onCancel: () => {},
  },
}

export const WithoutCancelButton: Story = {
  args: {
    children: <Kb.Text type="Body">Modal content without a cancel button.</Kb.Text>,
  },
}

export const SkipButton: Story = {
  args: {
    children: <Kb.Text type="Body">Modal with onCancel but skipButton=true (no button rendered).</Kb.Text>,
    onCancel: () => {},
    skipButton: true,
  },
}
