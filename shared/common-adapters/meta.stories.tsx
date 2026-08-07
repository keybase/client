import type {Meta, StoryObj} from '@storybook/react'
import MetaTag from './meta'
import * as Styles from '@/styles'

const meta: Meta<typeof MetaTag> = {
  component: MetaTag,
  title: 'CommonAdapters/Meta',
  args: {title: 'new', backgroundColor: Styles.getTheme().blue},
}
export default meta
type Story = StoryObj<typeof MetaTag>

export const New: Story = {
  args: {title: 'new', backgroundColor: Styles.getTheme().blue},
}

export const Public: Story = {
  args: {title: 'public', backgroundColor: Styles.getTheme().green},
}

export const Admin: Story = {
  args: {title: 'admin', backgroundColor: Styles.getTheme().blue},
}

export const Error: Story = {
  args: {title: 'error', backgroundColor: Styles.getTheme().red},
}

export const Small: Story = {
  args: {title: 'beta', backgroundColor: Styles.getTheme().purple, size: 'Small'},
}

export const NoUppercase: Story = {
  args: {title: 'keybase.io', backgroundColor: Styles.getTheme().blueGrey, noUppercase: true, color: Styles.getTheme().black_50},
}
