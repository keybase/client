import type {Meta, StoryObj} from '@storybook/react'
import {ProxySettings} from './proxy'

const meta: Meta<typeof ProxySettings> = {
  component: ProxySettings,
  title: 'Settings/Proxy',
}
export default meta
type Story = StoryObj<typeof ProxySettings>

export const Default: Story = {}
