import type {Meta, StoryObj} from '@storybook/react'
import MetaTag from './meta'
import * as Styles from '@/styles'

const meta: Meta<typeof MetaTag> = {
  component: MetaTag,
  title: 'CommonAdapters/Meta',
  args: {title: 'new', backgroundColor: Styles.globalColors.blue},
}
export default meta
type Story = StoryObj<typeof MetaTag>

export const New: Story = {
  args: {title: 'new', backgroundColor: Styles.globalColors.blue},
}

export const Public: Story = {
  args: {title: 'public', backgroundColor: Styles.globalColors.green},
}

export const Admin: Story = {
  args: {title: 'admin', backgroundColor: Styles.globalColors.blue},
}

export const Error: Story = {
  args: {title: 'error', backgroundColor: Styles.globalColors.red},
}

export const Small: Story = {
  args: {title: 'beta', backgroundColor: Styles.globalColors.purple, size: 'Small'},
}

export const NoUppercase: Story = {
  args: {title: 'keybase.io', backgroundColor: Styles.globalColors.blueGrey, noUppercase: true, color: Styles.globalColors.black_50},
}
