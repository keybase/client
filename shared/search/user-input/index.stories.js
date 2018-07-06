// @flow
import * as React from 'react'
import * as PropProviders from '../../stories/prop-providers'
import UserInput from '.'
import ConnectedUserInput, {type OwnProps, type Props} from './container'
import {Box} from '../../common-adapters'
import {compose, withStateHandlers} from 'recompose'
import {isMobile} from '../../constants/platform'
import {action, storiesOf, createPropProvider} from '../../stories/storybook'

const defaultOwnProps: OwnProps = {
  searchKey: 'search key',
  autoFocus: false,
  placeholder: 'Type someone',
  onExitSearch: action('onExitSearch'),
  onSelectUser: action('onSelectUser'),
}

const inputCommon = {
  autoFocus: false,
  onAddSelectedUser: action('Add selected user'),
  onCancel: action('Cancel'),
  onChangeText: action('Change text'),
  onClearSearch: action('Clear search'),
  onClickAddButton: action('Add button click'),
  onEnterEmptyText: action('onEnterEmptyText'),
  onMoveSelectDown: action('Move select down'),
  onMoveSelectUp: action('Move select up'),
  onRemoveUser: action('Remove user'),
  placeholder: 'Type someone',
  selectedSearchId: null,
}

const maxUsers = [
  {
    followingState: 'You',
    icon: null,
    id: 'chromakode',
    service: 'Keybase',
    username: 'chromakode',
  },
  {
    followingState: 'Following',
    icon: null,
    id: 'max',
    service: 'Keybase',
    username: 'max',
  },
  {
    followingState: 'NotFollowing',
    icon: 'icon-twitter-logo-16',
    id: 'denormalize@twitter',
    service: 'Twitter',
    username: 'denormalize',
  },
]

const chrisUsers = [
  {
    followingState: 'You',
    icon: null,
    id: 'chromakode',
    service: 'Keybase',
    username: 'chromakode',
  },
  {
    followingState: 'Following',
    icon: null,
    id: 'chris',
    service: 'Keybase',
    username: 'chris',
  },
  {
    followingState: 'Following',
    icon: 'icon-hacker-news-logo-16',
    id: 'cnojima@hackernews',
    service: 'Hacker News',
    username: 'cnojima',
  },
  {
    followingState: 'NotFollowing',
    icon: 'icon-twitter-logo-16',
    id: 'chriscoyier@twitter',
    service: 'Twitter',
    username: 'chriscoyier',
  },
  {
    followingState: 'NotFollowing',
    icon: 'icon-facebook-logo-16',
    id: 'chrisevans@facebook',
    service: 'Facebook',
    username: 'chrisevans',
  },
  {
    followingState: 'NotFollowing',
    icon: 'icon-github-logo-16',
    id: 'defunkt@github',
    service: 'GitHub',
    username: 'defunkt',
  },
  {
    followingState: 'NotFollowing',
    icon: 'icon-reddit-logo-16',
    id: 'KeyserSosa@reddit',
    service: 'Reddit',
    username: 'KeyserSosa',
  },
]

const defaultProps: Props = {
  ...inputCommon,
  userItems: maxUsers,
  usernameText: '',
  search: action('search'),
}

// TODO: Actually do something here.
const mockOwnPropsToProps = (ownProps: OwnProps): Props => {
  return defaultProps
}

export const makeSelectorMap = () => ({
  ...PropProviders.Common(),
  UserInput: mockOwnPropsToProps,
})

const provider = createPropProvider(makeSelectorMap())

const load = () => {
  storiesOf('Search/UserInput', module)
    .addDecorator(provider)
    .add('List', () => {
      return (
        <Box>
          <UserInput {...inputCommon} userItems={[]} usernameText="" />
          <UserInput {...inputCommon} userItems={maxUsers} usernameText="" />
          <UserInput {...inputCommon} userItems={maxUsers} usernameText="ma" />
          <UserInput
            {...inputCommon}
            userItems={maxUsers}
            usernameText=""
            onClearSearch={action('On clear search')}
          />
          <Box
            style={{
              borderColor: 'gray',
              borderStyle: 'solid',
              borderWidth: 2,
              padding: 4,
              width: isMobile ? 300 : 480,
            }}
          >
            <UserInput {...inputCommon} userItems={chrisUsers} usernameText="" />
          </Box>
          <Box
            style={{
              borderColor: 'gray',
              borderStyle: 'solid',
              borderWidth: 2,
              padding: 4,
              width: isMobile ? 300 : 370,
            }}
          >
            <UserInput {...inputCommon} userItems={maxUsers} usernameText="" />
          </Box>
        </Box>
      )
    })
    .add('Editable', () => {
      const UserInputEditable = compose(
        withStateHandlers(props => ({userItems: props.userItems, usernameText: ''}), {
          onChangeText: () => usernameText => ({usernameText}),
          onRemoveUser: ({userItems}) => (id: string) => ({
            userItems: userItems.filter(i => i.id !== id),
          }),
        })
      )(UserInput)

      return (
        <Box>
          <UserInputEditable {...inputCommon} userItems={[]} />
          <UserInputEditable {...inputCommon} userItems={chrisUsers} />
        </Box>
      )
    })
    .add('Connected', () => (
      <Box>
        <ConnectedUserInput {...defaultOwnProps} />
      </Box>
    ))
}

export default load
