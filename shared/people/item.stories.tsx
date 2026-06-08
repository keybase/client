import type {Meta, StoryObj} from '@storybook/react'
import * as Kb from '@/common-adapters'
import PeopleItem from './item'

const when = new Date('2024-03-15T10:00:00Z')

const meta: Meta<typeof PeopleItem> = {
  component: PeopleItem,
  title: 'People/Item',
  args: {
    badged: false,
    when,
  },
}
export default meta
type Story = StoryObj<typeof PeopleItem>

export const BasicText: Story = {
  args: {
    children: <Kb.Text type="Body">Someone followed you.</Kb.Text>,
    badged: false,
    when,
  },
}

export const Badged: Story = {
  args: {
    children: <Kb.Text type="Body">New activity on your account.</Kb.Text>,
    badged: true,
    when,
  },
}

export const WithIcon: Story = {
  args: {
    children: <Kb.Text type="Body">marcos followed you.</Kb.Text>,
    badged: false,
    icon: <Kb.Avatar username="marcos" size={32} />,
    when,
  },
}

export const WithButtons: Story = {
  args: {
    children: <Kb.Text type="Body">Add your phone number to your account.</Kb.Text>,
    badged: true,
    icon: <Kb.IconAuto type="icon-onboarding-phone-48" />,
    buttons: [
      {label: 'Add phone', onClick: () => {}},
      {label: 'Skip', mode: 'Secondary' as const, onClick: () => {}},
    ],
    when,
  },
}

export const MultiFormat: Story = {
  args: {
    children: <Kb.Text type="Body">marcelina, max, and 3 others started following you.</Kb.Text>,
    badged: false,
    format: 'multi' as const,
    when,
  },
}

export const NoTimestamp: Story = {
  args: {
    children: <Kb.Text type="Body">A pinned announcement from Keybase.</Kb.Text>,
    badged: false,
    icon: <Kb.ImageIcon type="icon-keybase-logo-80" style={{height: 32, width: 32}} />,
  },
}
