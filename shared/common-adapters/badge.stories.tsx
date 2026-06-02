import type {Meta, StoryObj} from '@storybook/react'
import Badge from './badge'

const meta: Meta<typeof Badge> = {
  component: Badge,
  title: 'CommonAdapters/Badge',
}
export default meta
type Story = StoryObj<typeof Badge>

export const Default: Story = {
  args: {badgeNumber: 3},
}

export const LargeNumber: Story = {
  args: {badgeNumber: 99},
}

export const VeryLargeNumber: Story = {
  args: {badgeNumber: 1234},
}

export const WithBorder: Story = {
  args: {badgeNumber: 5, border: true},
}

export const Large: Story = {
  args: {badgeNumber: 2, height: 24, fontSize: 14},
}
