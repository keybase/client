// @flow
import * as React from 'react'
import * as PropProviders from '../../stories/prop-providers'
import UserInput, {type UserDetails} from '.'
import ConnectedUserInput, {type OwnProps, type Props} from './container'
import {Box, Box2, Text} from '../../common-adapters'
import {collapseStyles} from '../../styles'
import {compose, withStateHandlers} from 'recompose'
import {isMobile} from '../../constants/platform'
import {action, storiesOf, createPropProvider, unexpected} from '../../stories/storybook'

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

const mockOwnPropsToProps = (userItems: Array<UserDetails>, ownProps: OwnProps): Props => {
  const props = {
    ...ownProps,
    ...inputCommon,
    onChangeText: unexpected('search should be used instead'),
    onClickAddButton: unexpected('search should be used instead'),
    usernameText: '',
    search: action('search'),

    userItems,
  }

  if (ownProps.onExitSearch) {
    props.onCancel = ownProps.onExitSearch
    props.onEnterEmptyText = ownProps.onExitSearch
  }

  return props
}

export const makeSelectorMap = (userItems: Array<UserDetails> = maxUsers) => ({
  ...PropProviders.Common(),
  UserInput: ownProps => mockOwnPropsToProps(userItems, ownProps),
})

const provider = createPropProvider(makeSelectorMap())

const UserInputEditable = compose(
  withStateHandlers(props => ({userItems: props.userItems, usernameText: ''}), {
    onChangeText: () => usernameText => ({usernameText}),
    onRemoveUser: ({userItems}) => (id: string) => ({
      userItems: userItems.filter(i => i.id !== id),
    }),
  })
)(UserInput)

const defaultBoxStyle = {
  borderColor: 'gray',
  borderStyle: 'solid',
  borderWidth: 2,
  padding: 4,
  width: isMobile ? 300 : 480,
}

const load = () => {
  storiesOf('Search/UserInput', module)
    .addDecorator(provider)
    .add('Empty list', () => (
      <Box style={collapseStyles([defaultBoxStyle, {height: 500}])}>
        <Text type="Body">Some text above</Text>
        <UserInput {...inputCommon} userItems={[]} usernameText="" />
        <Text type="Body">Some text below</Text>
      </Box>
    ))
    .add('Empty list (vertical Box2)', () => (
      <Box2 direction="vertical" style={collapseStyles([defaultBoxStyle, {height: 500}])}>
        <Text type="Body">Some text above</Text>
        <UserInput {...inputCommon} userItems={[]} usernameText="" />
        <Text type="Body">Some text below</Text>
      </Box2>
    ))
    .add('Empty list (horizontal Box2)', () => (
      <Box2 direction="horizontal" style={collapseStyles([defaultBoxStyle, {height: 500}])}>
        <Text type="Body">Some text left</Text>
        <UserInput {...inputCommon} userItems={[]} usernameText="" />
        <Text type="Body">Some text right</Text>
      </Box2>
    ))
    .add('List with items', () => (
      <Box style={defaultBoxStyle}>
        <UserInput {...inputCommon} userItems={maxUsers} usernameText="" />
      </Box>
    ))
    .add('List with items and partial input', () => (
      <Box style={defaultBoxStyle}>
        <UserInput {...inputCommon} userItems={maxUsers} usernameText="ma" />
      </Box>
    ))
    .add('List with many items', () => (
      <Box style={defaultBoxStyle}>
        <UserInput {...inputCommon} userItems={chrisUsers} usernameText="" />
      </Box>
    ))
    .add('Narrower list', () => (
      <Box
        style={{
          ...defaultBoxStyle,
          width: isMobile ? 300 : 370,
        }}
      >
        <UserInput {...inputCommon} userItems={maxUsers} usernameText="" />
      </Box>
    ))
    .add('Editable', () => {
      return (
        <Box style={defaultBoxStyle}>
          <UserInputEditable {...inputCommon} userItems={[]} />
        </Box>
      )
    })
    .add('Editable with items', () => {
      return (
        <Box style={defaultBoxStyle}>
          <UserInputEditable {...inputCommon} userItems={chrisUsers} />
        </Box>
      )
    })
    .add('Connected', () => (
      <Box style={defaultBoxStyle}>
        <ConnectedUserInput {...defaultOwnProps} />
      </Box>
    ))
    .add('Connected (vertical Box2)', () => (
      <Box2 direction="vertical" style={defaultBoxStyle}>
        <ConnectedUserInput {...defaultOwnProps} />
      </Box2>
    ))
    .add('Connected (horizontal Box2)', () => (
      <Box2 direction="horizontal" style={defaultBoxStyle}>
        <ConnectedUserInput {...defaultOwnProps} />
      </Box2>
    ))
}

export default load
