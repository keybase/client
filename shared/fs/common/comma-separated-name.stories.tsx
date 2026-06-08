import type {Meta, StoryObj} from '@storybook/react'
import CommaSeparatedName from './comma-separated-name'

const meta: Meta<typeof CommaSeparatedName> = {
  component: CommaSeparatedName,
  title: 'FS/CommaSeparatedName',
  args: {type: 'Body'},
}
export default meta
type Story = StoryObj<typeof CommaSeparatedName>

export const SingleName: Story = {
  args: {name: 'alice', type: 'Body'},
}

export const TwoNames: Story = {
  args: {name: 'alice,bob', type: 'Body'},
}

export const MultipleNames: Story = {
  args: {name: 'alice,bob,charlie,dave', type: 'BodySmall'},
}

export const Selectable: Story = {
  args: {name: 'alice,bob', type: 'BodySemibold', selectable: true},
}

export const Centered: Story = {
  args: {name: 'alice,bob,charlie', type: 'Header', center: true},
}
