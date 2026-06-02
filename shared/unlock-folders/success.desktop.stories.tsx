import type {Meta, StoryObj} from '@storybook/react'
import Success from './success.desktop'

const meta: Meta<typeof Success> = {
  component: Success,
  title: 'UnlockFolders/Success',
  args: {
    onClose: () => {},
  },
}
export default meta
type Story = StoryObj<typeof Success>

export const Default: Story = {}
