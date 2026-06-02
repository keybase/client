import type {Meta, StoryObj} from '@storybook/react'
import type * as T from '@/constants/types'
import TeamBox from './team-box'

const makeUser = (
  username: string,
  service: T.TB.ServiceIdWithContact = 'keybase',
  prettyName = ''
): T.TB.SelectedUser => ({
  prettyName,
  service,
  userId: `${username}@${service}`,
  username,
})

const meta: Meta<typeof TeamBox> = {
  component: TeamBox,
  title: 'TeamBuilding/TeamBox',
  args: {
    allowPhoneEmail: true,
    onChangeText: () => {},
    onEnterKeyDown: () => {},
    onDownArrowKeyDown: () => {},
    onUpArrowKeyDown: () => {},
    onRemove: () => {},
    onFinishTeamBuilding: () => {},
    searchString: '',
    teamSoFar: [],
  },
}
export default meta
type Story = StoryObj<typeof TeamBox>

export const Empty: Story = {}

export const OneKeybaseUser: Story = {
  args: {
    teamSoFar: [makeUser('testuser')],
  },
}

export const MixedServices: Story = {
  args: {
    teamSoFar: [
      makeUser('testuser'),
      makeUser('twitterfriend', 'twitter'),
      makeUser('15551234567', 'phone'),
      makeUser('user@example.com', 'email'),
    ],
  },
}

export const ManyUsers: Story = {
  args: {
    teamSoFar: [
      makeUser('alice'),
      makeUser('bob'),
      makeUser('charlie'),
      makeUser('david'),
      makeUser('eve'),
      makeUser('frank'),
    ],
  },
}

export const WithGoButtonLabel: Story = {
  args: {
    teamSoFar: [makeUser('testuser')],
    goButtonLabel: 'Add',
  },
}
