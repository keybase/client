import {useState} from 'react'
import type {Meta, StoryObj} from '@storybook/react'
import Checkbox from './checkbox'

const meta: Meta<typeof Checkbox> = {
  component: Checkbox,
  title: 'CommonAdapters/Checkbox',
  args: {label: 'Enable notifications', checked: false, onCheck: () => {}},
}
export default meta
type Story = StoryObj<typeof Checkbox>

export const Unchecked: Story = {
  args: {label: 'Enable notifications', checked: false},
}

export const Checked: Story = {
  args: {label: 'Enable notifications', checked: true},
}

export const Disabled: Story = {
  args: {label: 'Disabled option', checked: false, disabled: true},
}

export const DisabledChecked: Story = {
  args: {label: 'Disabled and checked', checked: true, disabled: true},
}

export const WithSubtitle: Story = {
  args: {
    label: 'Enable sound',
    labelSubtitle: 'Play a sound for each new message',
    checked: false,
  },
}

const InteractiveCheckbox = () => {
  const [checked, setChecked] = useState(false)
  return <Checkbox label="Click to toggle" checked={checked} onCheck={setChecked} />
}
export const Interactive: Story = {render: () => <InteractiveCheckbox />}
