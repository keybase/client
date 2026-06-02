import type {Meta, StoryObj} from '@storybook/react'
import SearchFilter from './search-filter'

const meta: Meta<typeof SearchFilter> = {
  component: SearchFilter,
  title: 'CommonAdapters/SearchFilter',
  args: {
    placeholderText: 'Search',
    size: 'full-width',
  },
}
export default meta
type Story = StoryObj<typeof SearchFilter>

export const FullWidth: Story = {
  args: {
    size: 'full-width',
    placeholderText: 'Search people or teams',
  },
}

export const Small: Story = {
  args: {
    size: 'small',
    placeholderText: 'Search',
  },
}

export const WithIcon: Story = {
  args: {
    size: 'full-width',
    placeholderText: 'Search',
    icon: 'iconfont-search',
  },
}

export const WithValue: Story = {
  args: {
    size: 'full-width',
    placeholderText: 'Search',
    valueControlled: true,
    value: 'alice',
  },
}

export const Waiting: Story = {
  args: {
    size: 'full-width',
    placeholderText: 'Search',
    waiting: true,
    valueControlled: true,
    value: 'searching...',
  },
}
