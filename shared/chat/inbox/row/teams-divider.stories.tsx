import type {Meta, StoryObj} from '@storybook/react'
import TeamsDivider from './teams-divider'

const meta: Meta<typeof TeamsDivider> = {
  component: TeamsDivider,
  title: 'Chat/TeamsDivider',
  args: {
    toggle: () => {},
    smallTeamsExpanded: false,
    showButton: false,
    hiddenCount: 0,
  },
}
export default meta
type Story = StoryObj<typeof TeamsDivider>

export const NoBigTeams: Story = {
  args: {showButton: false, hiddenCount: 0, smallTeamsExpanded: false},
}

export const WithButton: Story = {
  args: {showButton: true, hiddenCount: 12, smallTeamsExpanded: false},
}

export const WithButtonAndBadge: Story = {
  args: {showButton: true, hiddenCount: 5, smallTeamsExpanded: false, badgeCount: 3},
}

export const Expanded: Story = {
  args: {showButton: true, hiddenCount: 8, smallTeamsExpanded: true},
}
