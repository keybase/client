import type {Meta, StoryObj} from '@storybook/react'
import {HeaderTitle} from './nav-header'

const meta: Meta<typeof HeaderTitle> = {
  component: HeaderTitle,
  title: 'Git/NavHeaderTitle',
}
export default meta
type Story = StoryObj<typeof HeaderTitle>

export const Default: Story = {}
