// @noflow
import * as I from 'immutable'
import * as React from 'react'
import * as Constants from '../constants/search'
import ResultRow from './result-row'
import ResultsList from './results-list'
import ServicesFilter from './services-filter'
import UserInput from './user-input'
import {Box, Text} from '../common-adapters'
import {makeState as makeEntitiesState} from '../constants/entities'
import {compose, withHandlers, withState} from 'recompose'
import {isMobile} from '../constants/platform'
import {storiesOf, action} from '../stories/storybook'
import {Provider} from 'react-redux'
import {createStore} from 'redux'

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

const commonRow = {
  id: 'result',
  onClick: action('On click'),
  onShowTracker: action('Show tracker'),
  selected: false,
  showTrackerButton: false,
}
const kbRow = {
  ...commonRow,
  leftFollowingState: 'NoState',
  leftIcon: null,
  leftService: 'Keybase',
  leftUsername: 'jzila',
  rightFollowingState: 'NoState',
  rightFullname: 'John Zila',
  rightIcon: null,
  rightService: null,
  rightUsername: null,
}

const serviceRow = {
  ...commonRow,
  leftFollowingState: 'NoState',
  leftUsername: 'jzila',
  rightFollowingState: 'NoState',
  rightFullname: 'John Zila',
  rightIcon: null,
  rightService: null,
  rightUsername: null,
}

const load = () => {
  storiesOf('Search', module)
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
    .add('Result', () => {
      return (
        <Box style={isMobile ? {} : {width: 480}}>
          <ResultRow {...kbRow} />
          <ResultRow {...kbRow} selected={true} />
          <ResultRow {...kbRow} leftFollowingState="Following" />
          <ResultRow {...kbRow} leftFollowingState="NotFollowing" />
          <ResultRow {...kbRow} leftFollowingState="You" />
          <ResultRow {...kbRow} showTrackerButton={true} />
          <ResultRow
            {...kbRow}
            rightFullname="John Zila on GitHub"
            rightIcon="iconfont-identity-github"
            rightService="GitHub"
            rightUsername="jzilagithub"
          />
          <ResultRow
            {...kbRow}
            rightIcon="iconfont-identity-github"
            rightService="GitHub"
            rightUsername="jzilagithub"
          />
          <ResultRow {...serviceRow} leftIcon="icon-twitter-logo-24" leftService="Twitter" />
          <ResultRow
            {...serviceRow}
            leftIcon="icon-twitter-logo-24"
            leftService="Twitter"
            rightService="Keybase"
            rightUsername="jzila"
          />
          <ResultRow
            {...serviceRow}
            leftIcon="icon-twitter-logo-24"
            leftService="Twitter"
            rightFollowingState="Following"
            rightService="Keybase"
            rightUsername="jzila"
          />
          <ResultRow
            {...serviceRow}
            leftIcon="icon-twitter-logo-24"
            leftService="Twitter"
            rightFollowingState="NotFollowing"
            rightService="Keybase"
            rightUsername="jzila"
          />
          <ResultRow
            {...serviceRow}
            leftIcon="icon-twitter-logo-24"
            leftService="Twitter"
            rightFollowingState="You"
            rightService="Keybase"
            rightUsername="jzila"
          />
          <ResultRow {...serviceRow} leftIcon="icon-facebook-logo-24" leftService="Facebook" />
          <ResultRow {...serviceRow} leftIcon="icon-github-logo-24" leftService="GitHub" />
          <ResultRow {...serviceRow} leftIcon="icon-reddit-logo-24" leftService="Reddit" />
          <ResultRow {...serviceRow} leftIcon="icon-hacker-news-logo-24" leftService="Hacker News" />
        </Box>
      )
    })
    .add('Results List', () => {
      const common = {
        items: ['chris'],
        keyPath: ['searchChat'],
        onClick: action('On click'),
        onShowTracker: action('Show tracker'),
        selectedId: null,
        showSearchSuggestions: false,
      }
      const servicesResultsListMapCommonRows: {[key: string]: Constants.SearchResult} = {
        chris: {
          ...kbRow,
          leftFollowingState: 'Following',
          leftUsername: 'chris',
          rightFullname: 'chris on GitHub',
          rightIcon: 'iconfont-identity-github',
          rightService: 'GitHub',
          rightUsername: 'chrisname',
        },
        cjb: {
          ...kbRow,
          leftFollowingState: 'NotFollowing',
          leftUsername: 'cjb',
          rightFullname: 'cjb on facebook',
          rightIcon: 'iconfont-identity-facebook',
          rightService: 'Facebook',
          rightUsername: 'cjbname',
        },
        jzila: {
          ...kbRow,
          leftFollowingState: 'NoState',
          leftUsername: 'jzila',
          rightFullname: 'jzila on twitter',
          rightIcon: 'iconfont-identity-twitter',
          rightService: 'Twitter',
          rightUsername: 'jzilatwit',
        },
      }

      Object.keys(servicesResultsListMapCommonRows).forEach(name => {
        servicesResultsListMapCommonRows[name + '-fb'] = {
          ...servicesResultsListMapCommonRows[name],
          leftFollowingState: 'NoState',
          leftIcon: 'icon-facebook-logo-24',
          leftService: 'Facebook',
        }
      })

      Object.keys(servicesResultsListMapCommonRows).forEach(name => {
        // $FlowIssue gets confused
        servicesResultsListMapCommonRows[name] = I.Record(servicesResultsListMapCommonRows[name])
      })
      const store = {
        config: {
          following: {},
          username: 'tester',
        },
        entities: makeEntitiesState({
          searchResults: I.Map(servicesResultsListMapCommonRows),
        }),
      }
      return (
        <Provider store={createStore(ignore => store, store)}>
          <Box style={{width: 420}}>
            <Text type="Header">3 items</Text>
            <ResultsList {...common} items={['chris', 'cjb', 'jzila']} />
            <Text type="Header">1 item</Text>
            <ResultsList {...common} items={['chris']} />
            <Text type="Header">3 fb items</Text>
            <ResultsList {...common} items={['chris-fb', 'cjb-fb', 'jzila-fb']} />
            <Text type="Header">No items</Text>
            <ResultsList {...common} items={[]} />
          </Box>
        </Provider>
      )
    })
}

export default load
