import type {Meta, StoryObj} from '@storybook/react'
import {Splash} from './loading'

const meta: Meta<typeof Splash> = {
  component: Splash,
  title: 'Login/Splash',
}
export default meta
type Story = StoryObj<typeof Splash>

export const Loading: Story = {
  args: {
    failed: '',
    status: 'Loading...',
  },
}

export const StillTrying: Story = {
  args: {
    failed: '',
    status: 'Loading...  (still trying)',
  },
}

export const Failed: Story = {
  args: {
    failed: 'connection refused',
    status: '',
    onRetry: () => {},
  },
}

export const FailedWithFeedback: Story = {
  args: {
    failed: 'connection refused',
    status: '',
    onRetry: () => {},
    onFeedback: () => {},
  },
}
