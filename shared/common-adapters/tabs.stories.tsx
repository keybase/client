import {useState} from 'react'
import type {Meta, StoryObj} from '@storybook/react'
import Tabs from './tabs'
import type {Tab} from './tabs'

const simpleTabs: Array<Tab<string>> = [
  {title: 'profile'},
  {title: 'followers'},
  {title: 'following'},
]

const badgedTabs: Array<Tab<string>> = [
  {title: 'chat', badgeNumber: 3},
  {title: 'files'},
  {title: 'devices', badgeNumber: 1},
  {title: 'settings'},
]

const meta: Meta<typeof Tabs> = {
  component: Tabs,
  title: 'CommonAdapters/Tabs',
}
export default meta
type Story = StoryObj<typeof Tabs>

const BasicTabs = () => {
  const [selected, setSelected] = useState('profile')
  return <Tabs tabs={simpleTabs} onSelect={setSelected} selectedTab={selected} />
}
export const Basic: Story = {render: () => <BasicTabs />}

const WithBadgesTabs = () => {
  const [selected, setSelected] = useState('chat')
  return <Tabs tabs={badgedTabs} onSelect={setSelected} selectedTab={selected} />
}
export const WithBadges: Story = {render: () => <WithBadgesTabs />}

const WithProgressTabs = () => {
  const [selected, setSelected] = useState('profile')
  return <Tabs tabs={simpleTabs} onSelect={setSelected} selectedTab={selected} showProgressIndicator={true} />
}
export const WithProgress: Story = {render: () => <WithProgressTabs />}
