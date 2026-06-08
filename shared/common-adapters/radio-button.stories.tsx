import {useState} from 'react'
import type {Meta, StoryObj} from '@storybook/react'
import RadioButton from './radio-button'

const meta: Meta<typeof RadioButton> = {
  component: RadioButton,
  title: 'CommonAdapters/RadioButton',
  args: {label: 'Option A', selected: false, onSelect: () => {}},
}
export default meta
type Story = StoryObj<typeof RadioButton>

export const Unselected: Story = {
  args: {label: 'Option A', selected: false},
}

export const Selected: Story = {
  args: {label: 'Option A', selected: true},
}

export const Disabled: Story = {
  args: {label: 'Disabled option', selected: false, disabled: true},
}

export const DisabledSelected: Story = {
  args: {label: 'Disabled selected', selected: true, disabled: true},
}

const InteractiveButton = () => {
  const [selected, setSelected] = useState(false)
  return <RadioButton label="Click to toggle" selected={selected} onSelect={setSelected} />
}
export const Interactive: Story = {render: () => <InteractiveButton />}
