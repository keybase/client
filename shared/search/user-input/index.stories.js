// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import UserInput, {type UserDetails} from '.'
import ConnectedUserInput, {type OwnProps, type Props} from './container'
import {Box, Box2, Text} from '../../common-adapters'
import {collapseStyles} from '../../styles'
import {compose, withStateHandlers} from 'recompose'
import {isMobile} from '../../constants/platform'

const defaultOwnProps: OwnProps = {
  searchKey: 'search key',
  autoFocus: false,
  hideClearSearch: false,
  placeholder: 'Type someone',
  onExitSearch: Sb.action('onExitSearch'),
  onSelectUser: Sb.action('onSelectUser'),
  onFocus: Sb.action('onFocus'),
  showServiceFilter: true,
}

const inputCommon = {
  autoFocus: false,
  hideClearSearch: false,
  hideAddButton: false,
  onFocus: Sb.action('onFocus'),
  onAddSelectedUser: Sb.action('Add selected user'),
  onCancel: Sb.action('Cancel'),
  onChangeText: Sb.action('Change text'),
  onClearSearch: Sb.action('Clear search'),
  onClickAddButton: Sb.action('Add button click'),
  onEnterEmptyText: Sb.action('onEnterEmptyText'),
  onMoveSelectDown: Sb.action('Move select down'),
  onMoveSelectUp: Sb.action('Move select up'),
  onRemoveUser: Sb.action('Remove user'),
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
    onChangeText: Sb.unexpected('search should be used instead'),
    onClickAddButton: Sb.unexpected('search should be used instead'),
    usernameText: '',
    search: Sb.action('search'),

    userItems,
  }

  if (ownProps.onExitSearch) {
    props.onCancel = ownProps.onExitSearch
    props.onEnterEmptyText = ownProps.onExitSearch
  }

  return props
}

export const makeSelectorMap = (userItems: Array<UserDetails> = maxUsers) => ({
  UserInput: (ownProps: OwnProps) => mockOwnPropsToProps(userItems, ownProps),
})

const provider = Sb.createPropProviderWithCommon(makeSelectorMap())

const UserInputEditable = compose(
  withStateHandlers(props => ({userItems: props.userItems, usernameText: ''}), {
    onChangeText: (_, {onChangeText}) => usernameText => {
      onChangeText(usernameText)
      return {usernameText}
    },
    onRemoveUser: ({userItems}, {onRemoveUser}) => (id: string) => {
      onRemoveUser(id)
      return {
        userItems: userItems.filter(i => i.id !== id),
      }
    },
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
  Sb.storiesOf('Search/UserInput', module)
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
        <Box2 direction="vertical" fullWidth={true}>
          <UserInput {...inputCommon} userItems={[]} usernameText="" />
        </Box2>
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
