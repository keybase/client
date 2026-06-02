import type {Meta, StoryObj} from '@storybook/react'
import Bio from './bio'

const meta: Meta<typeof Bio> = {
  component: Bio,
  title: 'Tracker/Bio',
  args: {
    blocked: false,
    followThem: false,
    followsYou: false,
    hidFromFollowers: false,
    inTracker: false,
    username: 'alice',
  },
}
export default meta
type Story = StoryObj<typeof Bio>

export const Basic: Story = {
  args: {
    username: 'alice',
    fullname: 'Alice Smith',
    bio: 'Software engineer and open source enthusiast.',
    location: 'San Francisco, CA',
    followersCount: 142,
    followingCount: 37,
    followThem: false,
    followsYou: false,
  },
}

export const FollowsYou: Story = {
  args: {
    username: 'bob',
    fullname: 'Bob Johnson',
    bio: 'Cryptographer and privacy advocate.',
    followersCount: 500,
    followingCount: 120,
    followThem: false,
    followsYou: true,
  },
}

export const FollowEachOther: Story = {
  args: {
    username: 'carol',
    fullname: 'Carol White',
    bio: 'Building secure communications for everyone.',
    location: 'New York, NY',
    followersCount: 88,
    followingCount: 55,
    followThem: true,
    followsYou: true,
  },
}

export const YouFollowThem: Story = {
  args: {
    username: 'dave',
    fullname: 'Dave Davis',
    bio: 'Open source contributor.',
    followersCount: 210,
    followingCount: 90,
    followThem: true,
    followsYou: false,
  },
}

export const InTracker: Story = {
  args: {
    username: 'eve',
    fullname: 'Eve Brown',
    bio: 'This is a longer bio that will get clamped when displayed inside the tracker popup because inTracker is true and lineClamp kicks in.',
    location: 'Austin, TX — a long location that gets truncated too',
    followersCount: 1024,
    followingCount: 256,
    followThem: false,
    followsYou: true,
    inTracker: true,
  },
}

export const Blocked: Story = {
  args: {
    username: 'badactor',
    fullname: 'Bad Actor',
    blocked: true,
    followThem: false,
    followsYou: false,
  },
}

export const HidFromFollowers: Story = {
  args: {
    username: 'quietuser',
    fullname: 'Quiet User',
    bio: 'Prefers to stay off the radar.',
    hidFromFollowers: true,
    followThem: false,
    followsYou: false,
  },
}

export const NoBioOrLocation: Story = {
  args: {
    username: 'minimal',
    fullname: 'Minimal User',
    followersCount: 0,
    followingCount: 0,
    followThem: false,
    followsYou: false,
  },
}

export const WithSbsDescription: Story = {
  args: {
    username: '',
    sbsDescription: 'frank@proton.me on ProtonMail',
    followThem: false,
    followsYou: false,
  },
}
