import type {Meta, StoryObj} from '@storybook/react'
import LoadingScreen from './loading'

const meta: Meta<typeof LoadingScreen> = {
  component: LoadingScreen,
  title: 'FS/LoadingScreen',
}
export default meta
type Story = StoryObj<typeof LoadingScreen>

export const Default: Story = {}

export const WithReason: Story = {
  args: {why: ' listing files'},
}
