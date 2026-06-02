import type {Meta, StoryObj} from '@storybook/react'
import MarkdownMemo from './markdown-memo'

const meta: Meta<typeof MarkdownMemo> = {
  component: MarkdownMemo,
  title: 'Wallets/MarkdownMemo',
}
export default meta
type Story = StoryObj<typeof MarkdownMemo>

export const PlainText: Story = {
  args: {memo: 'Payment for coffee'},
}

export const LongText: Story = {
  args: {
    memo: 'This is a longer payment memo that goes into more detail about the transaction and why it was made.',
  },
}

export const WithMarkdownBold: Story = {
  args: {memo: 'Payment for **coffee** and *snacks*'},
}

export const WithMarkdownLink: Story = {
  args: {memo: 'See invoice at https://example.com/invoice/123'},
}

export const EmptyMemo: Story = {
  // renders null when memo is empty
  args: {memo: ''},
}

export const HideDivider: Story = {
  args: {
    memo: 'Payment without divider',
    hideDivider: true,
  },
}
