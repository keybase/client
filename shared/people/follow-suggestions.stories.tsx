import type {Meta, StoryObj} from '@storybook/react'
import type {FollowSuggestion} from './follow-suggestions'
import FollowSuggestions from './follow-suggestions'

const makeSuggestion = (overrides: Partial<FollowSuggestion> = {}): FollowSuggestion => ({
  followsMe: false,
  fullName: '',
  iFollow: false,
  username: 'user',
  ...overrides,
})

const meta: Meta<typeof FollowSuggestions> = {
  component: FollowSuggestions,
  title: 'People/FollowSuggestions',
}
export default meta
type Story = StoryObj<typeof FollowSuggestions>

export const Default: Story = {
  args: {
    suggestions: [
      makeSuggestion({username: 'alice', fullName: 'Alice Smith', followsMe: true}),
      makeSuggestion({username: 'bob', fullName: 'Bob Johnson'}),
      makeSuggestion({username: 'carol', fullName: 'Carol White', iFollow: true}),
      makeSuggestion({username: 'dave'}),
      makeSuggestion({username: 'eve', fullName: 'Eve Brown', followsMe: true, iFollow: true}),
    ],
  },
}

export const FewSuggestions: Story = {
  args: {
    suggestions: [
      makeSuggestion({username: 'keybase', fullName: 'Keybase'}),
      makeSuggestion({username: 'kbnews', fullName: 'Keybase News'}),
    ],
  },
}

export const ManySuggestions: Story = {
  args: {
    suggestions: [
      makeSuggestion({username: 'alice', fullName: 'Alice Smith'}),
      makeSuggestion({username: 'bob', fullName: 'Bob Johnson'}),
      makeSuggestion({username: 'carol', fullName: 'Carol White'}),
      makeSuggestion({username: 'dave', fullName: 'Dave Davis'}),
      makeSuggestion({username: 'eve', fullName: 'Eve Brown'}),
      makeSuggestion({username: 'frank', fullName: 'Frank Lee'}),
      makeSuggestion({username: 'grace', fullName: 'Grace Park'}),
      makeSuggestion({username: 'heidi', fullName: 'Heidi Chan'}),
    ],
  },
}

export const NoFullNames: Story = {
  args: {
    suggestions: [
      makeSuggestion({username: 'user1'}),
      makeSuggestion({username: 'user2'}),
      makeSuggestion({username: 'user3'}),
    ],
  },
}
