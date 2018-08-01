// @flow
import * as React from 'react'
import {Box2} from '../../common-adapters'
import {action, storiesOf, createPropProvider} from '../../stories/storybook'
import Search from '.'
import {makeSelectorMap as makeResultsListSelectorMap} from '../../search/results-list/index.stories'
import {type ConnectPropsMap as RowConnectPropsMap} from '../../search/result-row/index.stories'
import {makeSelectorMap as makeUserInputSelectorMap} from '../../search/user-input/index.stories'

const Wrapper = ({children}) => (
  <Box2 direction="vertical" style={{height: 580, minWidth: 640}}>
    {children}
  </Box2>
)

const connectPropsMap: RowConnectPropsMap = {
  chris: {
    leftFullname: 'chris',
    leftIcon: null,
    leftIconOpaque: true,
    leftService: 'Keybase',
    leftUsername: 'Chris Coyne',

    rightIcon: null,
    rightIconOpaque: true,
    rightService: null,
    rightUsername: null,

    leftFollowingState: 'Following',
    rightFollowingState: 'NoState',
    userIsInTeam: false,
    userAlreadySelected: false,
    userIsSelectable: true,
  },
  cjb: {
    leftFullname: 'cjb',
    leftIcon: null,
    leftIconOpaque: true,
    leftService: 'Keybase',
    leftUsername: 'Chris Ball',

    rightIcon: null,
    rightIconOpaque: true,
    rightService: null,
    rightUsername: null,

    leftFollowingState: 'NotFollowing',
    rightFollowingState: 'NoState',
    userIsInTeam: false,
    userAlreadySelected: false,
    userIsSelectable: true,
  },
  jzila: {
    leftFullname: 'jzila',
    leftIcon: null,
    leftIconOpaque: true,
    leftService: 'Keybase',
    leftUsername: 'John Zila',

    rightIcon: null,
    rightIconOpaque: true,
    rightService: null,
    rightUsername: null,

    leftFollowingState: 'NotFollowing',
    rightFollowingState: 'NoState',
    userIsInTeam: false,
    userAlreadySelected: false,
    userIsSelectable: true,
  },
}

const provider = createPropProvider({
  ...makeResultsListSelectorMap(connectPropsMap),
  ...makeUserInputSelectorMap([]),
})

const load = () => {
  storiesOf('Wallets', module)
    .addDecorator(provider)
    .add('Search', () => (
      <Wrapper>
        <Search
          onClick={action('onClick')}
          onClose={action('onClose')}
          onShowTracker={action('onShowTracker')}
        />
      </Wrapper>
    ))
}

export default load
