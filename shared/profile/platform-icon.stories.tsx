import type {Meta, StoryObj} from '@storybook/react'
import PlatformIcon from './platform-icon'

const meta: Meta<typeof PlatformIcon> = {
  component: PlatformIcon,
  title: 'Profile/PlatformIcon',
}
export default meta
type Story = StoryObj<typeof PlatformIcon>

export const Twitter: Story = {
  args: {
    platform: 'twitter',
    overlay: 'iconfont-proof-good',
  },
}

export const GitHub: Story = {
  args: {
    platform: 'github',
    overlay: 'iconfont-proof-good',
  },
}

export const Reddit: Story = {
  args: {
    platform: 'reddit',
    overlay: 'iconfont-proof-good',
  },
}

export const HackerNews: Story = {
  args: {
    platform: 'hackernews',
    overlay: 'iconfont-proof-good',
  },
}

export const Website: Story = {
  args: {
    platform: 'web',
    overlay: 'iconfont-proof-good',
  },
}

export const Bitcoin: Story = {
  args: {
    platform: 'btc',
    overlay: 'iconfont-proof-good',
  },
}

export const PGP: Story = {
  args: {
    platform: 'pgp',
    overlay: 'iconfont-proof-good',
  },
}

export const BrokenProof: Story = {
  args: {
    platform: 'twitter',
    overlay: 'iconfont-proof-broken',
    overlayColor: 'red',
  },
}
