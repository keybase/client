// @flow
import React from 'react'
import {Box} from '../common-adapters'
import {storiesOf, action} from '../stories/storybook'
import {isMobile} from '../constants/platform'
import {compose, withHandlers, withState} from 'recompose'

import ServicesFilter from './services-filter'
// import ResultRow from './result-row'
// import ResultsList from './results-list'
import UserInput from './user-input'

const inputCommon = {
  onAddSelectedUser: action('Add selected user'),
  onCancel: action('Cancel'),
  onChangeText: action('Change text'),
  onClickAddButton: action('Add button click'),
  onMoveSelectDown: action('Move select down'),
  onMoveSelectUp: action('Move select up'),
  onRemoveUser: action('Remove user'),
  placeholder: 'Type someone',
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
const load = () => {
  storiesOf('SearchV3', module)
    .add('Filter', () => {
      const common = {
        onSelectService: action('Selected service'),
      }

      return (
        <Box>
          <ServicesFilter {...common} selectedService="Keybase" />
          <ServicesFilter {...common} selectedService="Twitter" />
          <ServicesFilter {...common} selectedService="Facebook" />
          <ServicesFilter {...common} selectedService="GitHub" />
          <ServicesFilter {...common} selectedService="Reddit" />
          <ServicesFilter {...common} selectedService="Hacker News" />
        </Box>
      )
    })
    .add('User Input', () => {
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
    .add('User Input editable', () => {
      const UserInputEditable = compose(
        withState('usernameText', 'onChangeText', ''),
        withState('userItems', 'setUserItems', ({userItems}) => userItems),
        withHandlers({
          onRemoveUser: ({setUserItems, userItems}) => (id: string) => {
            setUserItems(userItems.filter(i => i.id !== id))
          },
        })
      )(UserInput)

      return (
        <Box>
          <UserInputEditable {...inputCommon} userItems={[]} />
          <UserInputEditable {...inputCommon} userItems={chrisUsers} />
        </Box>
      )
    })
}

export default load
