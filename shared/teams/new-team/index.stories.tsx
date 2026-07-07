import type {Meta, StoryObj} from '@storybook/react'
import {CreateNewTeam} from './index'

const meta: Meta<typeof CreateNewTeam> = {
  component: CreateNewTeam,
  title: 'Teams/CreateNewTeam',
  args: {
    onSubmit: () => {},
  },
}
export default meta
type Story = StoryObj<typeof CreateNewTeam>

export const NewTopLevelTeam: Story = {}

export const NewSubteam: Story = {
  args: {baseTeam: 'keybase'},
}

export const NewDeepSubteam: Story = {
  args: {baseTeam: 'keybase.design'},
}
