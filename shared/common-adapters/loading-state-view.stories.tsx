import type {Meta, StoryObj} from '@storybook/react'
import LoadingStateView from './loading-state-view'

const meta: Meta<typeof LoadingStateView> = {
  component: LoadingStateView,
  title: 'CommonAdapters/LoadingStateView',
  args: {loading: true},
}
export default meta
type Story = StoryObj<typeof LoadingStateView>

export const Loading: Story = {
  args: {loading: true},
}

export const LoadingWithProgress: Story = {
  args: {loading: true, progress: 0.6},
}

export const LoadingWhite: Story = {
  args: {loading: true, white: true},
  decorators: [
    Story => (
      <div style={{background: '#333', height: 100, position: 'relative', width: 300}}>
        <Story />
      </div>
    ),
  ],
}

export const NotLoading: Story = {
  args: {loading: false},
  // Should render nothing
}
