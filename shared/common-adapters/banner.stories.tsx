import type {Meta, StoryObj} from '@storybook/react'
import {Banner, BannerParagraph} from './banner'

const meta: Meta<typeof Banner> = {
  component: Banner,
  title: 'CommonAdapters/Banner',
  args: {color: 'blue', children: 'This is an informational banner message.'},
}
export default meta
type Story = StoryObj<typeof Banner>

export const Blue: Story = {
  args: {color: 'blue', children: 'Your device has been revoked. Please provision again.'},
}

export const Red: Story = {
  args: {color: 'red', children: 'Something went wrong. Please try again.'},
}

export const Yellow: Story = {
  args: {color: 'yellow', children: 'You are in read-only mode due to a connectivity issue.'},
}

export const Green: Story = {
  args: {color: 'green', children: 'Your files are fully synced.'},
}

export const Grey: Story = {
  args: {color: 'grey', children: 'You have no unread messages.'},
}

export const WithCloseButton: Story = {
  args: {
    color: 'blue',
    children: 'You have a new message.',
    onClose: () => {},
  },
}

export const Small: Story = {
  args: {
    color: 'yellow',
    children: 'Low disk space.',
    small: true,
  },
}

export const WithParagraph: Story = {
  args: {
    color: 'red',
    children: (
      <BannerParagraph
        bannerColor="red"
        content={[
          'Some of ',
          {onClick: () => {}, text: 'alice'},
          "'s proofs have changed since you last followed them.",
        ]}
      />
    ),
  },
}
