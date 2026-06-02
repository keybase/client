import type {Meta, StoryObj} from '@storybook/react'
import {EnterEmailBody} from './email'

const meta: Meta<typeof EnterEmailBody> = {
  component: EnterEmailBody,
  title: 'Signup/EnterEmail',
  args: {
    onChangeEmail: () => {},
    onContinue: () => {},
    email: '',
    searchable: true,
    onChangeSearchable: () => {},
    showSearchable: true,
    iconType: 'icon-email-add-96',
  },
}
export default meta
type Story = StoryObj<typeof EnterEmailBody>

export const Empty: Story = {}

export const Filled: Story = {
  args: {
    email: 'user@example.com',
  },
}

export const NotSearchable: Story = {
  args: {
    email: 'private@example.com',
    searchable: false,
  },
}

export const HideSearchable: Story = {
  args: {
    showSearchable: false,
    iconType: 'icon-email-add-64',
  },
}
