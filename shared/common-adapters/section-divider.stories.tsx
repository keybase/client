import {useState} from 'react'
import type {Meta, StoryObj} from '@storybook/react'
import SectionDivider from './section-divider'

const meta: Meta<typeof SectionDivider> = {
  component: SectionDivider,
  title: 'CommonAdapters/SectionDivider',
}
export default meta
type Story = StoryObj<typeof SectionDivider>

export const SimpleLabel: Story = {
  args: {label: 'Section Header'},
}

export const WithSpinner: Story = {
  args: {label: 'Loading section', showSpinner: true},
}

const ExpandedSection = () => {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <SectionDivider
      label="Collapsible Section"
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed(c => !c)}
    />
  )
}
export const CollapsibleExpanded: Story = {render: () => <ExpandedSection />}

const CollapsedSection = () => {
  const [collapsed, setCollapsed] = useState(true)
  return (
    <SectionDivider
      label="Collapsed Section"
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed(c => !c)}
    />
  )
}
export const CollapsibleCollapsed: Story = {render: () => <CollapsedSection />}
