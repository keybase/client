import type {Meta, StoryObj} from '@storybook/react'
import ProgressBar from './progress-bar'

const meta: Meta<typeof ProgressBar> = {
  component: ProgressBar,
  title: 'CommonAdapters/ProgressBar',
  args: {ratio: 0.5},
}
export default meta
type Story = StoryObj<typeof ProgressBar>

export const Empty: Story = {
  args: {ratio: 0},
}

export const Quarter: Story = {
  args: {ratio: 0.25},
}

export const Half: Story = {
  args: {ratio: 0.5},
}

export const ThreeQuarters: Story = {
  args: {ratio: 0.75},
}

export const Full: Story = {
  args: {ratio: 1},
}
