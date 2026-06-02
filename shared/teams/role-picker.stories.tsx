import type {Meta, StoryObj} from '@storybook/react'
import {FloatingRolePicker} from './role-picker'

// FloatingRolePicker wraps RolePicker (which is not directly exported).
// Stories use open={true} to render the picker content visibly.

const meta: Meta<typeof FloatingRolePicker> = {
  component: FloatingRolePicker,
  title: 'Teams/RolePicker',
  args: {
    onConfirm: () => {},
    open: true,
  },
}
export default meta
type Story = StoryObj<typeof FloatingRolePicker>

export const DefaultReader: Story = {
  args: {presetRole: 'reader'},
}

export const PresetWriter: Story = {
  args: {presetRole: 'writer'},
}

export const PresetAdmin: Story = {
  args: {presetRole: 'admin'},
}

export const PresetOwner: Story = {
  args: {presetRole: 'owner'},
}

export const WithCancelButton: Story = {
  args: {presetRole: 'reader', onCancel: () => {}},
}

export const WithSetIndividually: Story = {
  args: {presetRole: 'reader', includeSetIndividually: true, onCancel: () => {}},
}

export const PluralRoles: Story = {
  args: {presetRole: 'writer', plural: true},
}

export const DisabledOwner: Story = {
  args: {
    presetRole: 'reader',
    disabledRoles: {owner: 'Cannot invite an owner via email.'},
  },
}

export const Waiting: Story = {
  args: {presetRole: 'writer', waiting: true},
}
