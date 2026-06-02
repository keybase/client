import type {Meta, StoryObj} from '@storybook/react'
import {EnterPhoneNumberBody} from './index'

const meta: Meta<typeof EnterPhoneNumberBody> = {
  component: EnterPhoneNumberBody,
  title: 'Signup/EnterPhoneNumber',
  args: {
    onChangeNumber: () => {},
    onContinue: () => {},
    searchable: true,
    iconType: 'icon-phone-number-add-96',
  },
}
export default meta
type Story = StoryObj<typeof EnterPhoneNumberBody>

export const Empty: Story = {}

export const WithSearchable: Story = {
  args: {
    onChangeSearchable: () => {},
    searchable: true,
  },
}

export const NotSearchable: Story = {
  args: {
    onChangeSearchable: () => {},
    searchable: false,
  },
}

export const SmallIcon: Story = {
  args: {
    iconType: 'icon-phone-number-add-64',
  },
}
