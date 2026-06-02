import type * as React from 'react'
import type {Meta, StoryObj} from '@storybook/react'
import Icon from './icon'
import {Box2} from './box'
import * as Styles from '@/styles'

const iconShowcase: Array<{type: React.ComponentProps<typeof Icon>['type']; label: string}> = [
  {label: 'Search', type: 'iconfont-search'},
  {label: 'Close', type: 'iconfont-close'},
  {label: 'Edit', type: 'iconfont-edit'},
  {label: 'Add', type: 'iconfont-new'},
  {label: 'Lock', type: 'iconfont-lock'},
  {label: 'Star', type: 'iconfont-star'},
  {label: 'Check', type: 'iconfont-check'},
  {label: 'Arrow Up', type: 'iconfont-arrow-up'},
  {label: 'Arrow Down', type: 'iconfont-arrow-down'},
]

const meta: Meta<typeof Icon> = {
  component: Icon,
  title: 'CommonAdapters/Icon',
  args: {type: 'iconfont-search'},
}
export default meta
type Story = StoryObj<typeof Icon>

export const Default: Story = {
  args: {type: 'iconfont-search'},
}

export const Colored: Story = {
  args: {type: 'iconfont-star', color: Styles.globalColors.blue},
}

export const Large: Story = {
  args: {type: 'iconfont-search', sizeType: 'Big'},
}

export const Small: Story = {
  args: {type: 'iconfont-search', sizeType: 'Small'},
}

export const Clickable: Story = {
  args: {type: 'iconfont-edit', onClick: () => {}, color: Styles.globalColors.blue},
}

export const Showcase: Story = {
  render: () => (
    <Box2 direction="horizontal" gap="medium" style={{flexWrap: 'wrap', padding: Styles.globalMargins.medium}}>
      {iconShowcase.map(({type, label}) => (
        <Box2 key={type} direction="vertical" centerChildren={true} gap="xtiny">
          <Icon type={type} />
          <span style={{fontSize: 10, color: '#666'}}>{label}</span>
        </Box2>
      ))}
    </Box2>
  ),
}
