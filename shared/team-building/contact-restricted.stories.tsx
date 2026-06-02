import type {Meta, StoryObj} from '@storybook/react'
import {ContactRestricted} from './contact-restricted'

const meta: Meta<typeof ContactRestricted> = {
  component: ContactRestricted,
  title: 'TeamBuilding/ContactRestricted',
}
export default meta
type Story = StoryObj<typeof ContactRestricted>

export const NewFolder: Story = {
  args: {
    source: 'newFolder',
    usernames: ['restricteduser'],
  },
}

export const TeamAddAllFailedSolo: Story = {
  args: {
    source: 'teamAddAllFailed',
    usernames: ['restricteduser'],
  },
}

export const TeamAddAllFailedMultiple: Story = {
  args: {
    source: 'teamAddAllFailed',
    usernames: ['alice', 'bob', 'charlie'],
  },
}

export const TeamAddSomeFailed: Story = {
  args: {
    source: 'teamAddSomeFailed',
    usernames: ['alice', 'bob'],
  },
}
