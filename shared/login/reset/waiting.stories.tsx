import type {Meta, StoryObj} from '@storybook/react'
import Waiting from './waiting'

const meta: Meta<typeof Waiting> = {
  component: Waiting,
  title: 'Login/ResetWaiting',
}
export default meta
type Story = StoryObj<typeof Waiting>

const futureTime = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days from now

export const CheckEmailOrPhone: Story = {
  args: {
    pipelineStarted: false,
    username: 'testuser',
  },
}

export const PipelineStarted: Story = {
  args: {
    endTime: futureTime,
    pipelineStarted: true,
    username: 'testuser',
  },
}
