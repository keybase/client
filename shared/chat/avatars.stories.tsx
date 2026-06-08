import type {Meta, StoryObj} from '@storybook/react'
import {Avatars, TeamAvatar} from './avatars'

const meta: Meta<typeof Avatars> = {
  component: Avatars,
  title: 'Chat/Avatars',
}
export default meta
type Story = StoryObj<typeof Avatars>

export const SingleUser: Story = {
  args: {participantOne: 'alice'},
}

export const TwoUsers: Story = {
  args: {participantOne: 'alice', participantTwo: 'bob'},
}

export const Muted: Story = {
  args: {participantOne: 'alice', participantTwo: 'bob', isMuted: true},
}

export const Selected: Story = {
  args: {participantOne: 'alice', participantTwo: 'bob', isSelected: true},
}

export const Locked: Story = {
  args: {participantOne: 'alice', participantTwo: 'bob', isLocked: true},
}

export const SmallSize: Story = {
  args: {participantOne: 'alice', singleSize: 32},
}

export const LargeSize: Story = {
  args: {participantOne: 'alice', singleSize: 96},
}

type TeamStory = StoryObj<typeof TeamAvatar>

export const Team: TeamStory = {
  render: () => (
    <TeamAvatar teamname="keybase" isMuted={false} isSelected={false} isHovered={false} />
  ),
}

export const TeamMuted: TeamStory = {
  render: () => (
    <TeamAvatar teamname="keybase" isMuted={true} isSelected={false} isHovered={false} />
  ),
}

export const TeamSelected: TeamStory = {
  render: () => (
    <TeamAvatar teamname="keybase" isMuted={false} isSelected={true} isHovered={false} />
  ),
}
