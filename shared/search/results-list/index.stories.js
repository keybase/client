// @flow
import * as React from 'react'
import ResultsList from '.'
import ConnectedResultsList from './container'
import {Box} from '../../common-adapters'
import {storiesOf, action, createPropProvider} from '../../stories/storybook'
import * as PropProviders from '../../stories/prop-providers'
import {
  type ConnectPropsMap as RowConnectPropsMap,
  makeSelectorMap as makeRowSelectorMap,
} from '../result-row/index.stories'

const connectPropsMap: RowConnectPropsMap = {
  chris: {
    leftFullname: 'chris on GitHub',
    leftIcon: null,
    leftService: 'Keybase',
    leftUsername: 'chris',

    rightIcon: 'iconfont-identity-github',
    rightService: 'GitHub',
    rightUsername: 'chrisname',

    leftFollowingState: 'Following',
    rightFollowingState: 'NoState',
    userIsInTeam: false,
  },
  cjb: {
    leftFullname: 'cjb on facebook',
    leftIcon: null,
    leftService: 'Keybase',
    leftUsername: 'cjb',

    rightIcon: 'iconfont-identity-facebook',
    rightService: 'Facebook',
    rightUsername: 'cjbname',

    leftFollowingState: 'NotFollowing',
    rightFollowingState: 'NoState',
    userIsInTeam: false,
  },
  jzila: {
    leftFullname: 'jzila on twitter',
    leftIcon: null,
    leftService: 'Keybase',
    leftUsername: 'jzila',

    rightIcon: 'iconfont-identity-twitter',
    rightService: 'Twitter',
    rightUsername: 'jzilatwit',

    leftFollowingState: 'NotFollowing',
    rightFollowingState: 'NoState',
    userIsInTeam: false,
  },
}

Object.keys(connectPropsMap).forEach(id => {
  connectPropsMap[id + '-fb'] = {
    ...connectPropsMap[id],
    leftFollowingState: 'NoState',
    leftIcon: 'icon-facebook-logo-24',
    leftService: 'Facebook',
  }
})

const provider = createPropProvider(PropProviders.Common(), makeRowSelectorMap(connectPropsMap), {
  ResultsList: ownProps => props,
})

const ownProps = {
  searchKey: 'search-key',
  disableIfInTeamName: '',
  onClick: action('onClick'),
  onMouseOver: action('onMouseOver'),
  onShowTracker: action('onShowTracker'),
}

const props = {
  disableIfInTeamName: '',
  items: Object.keys(connectPropsMap),
  onClick: action('onClick'),
  onMouseOver: action('onMouseOver'),
  onShowTracker: action('onShowTracker'),
  selectedId: null,
  showSearchSuggestions: false,
}

const load = () => {
  storiesOf('Search/ResultsList', module)
    .addDecorator(provider)
    .addDecorator(story => <Box style={{width: 420}}>{story()}</Box>)
    .add('keybaseResults', () => <ResultsList {...props} items={['chris', 'cjb', 'jzila']} />)
    .add('keybaseResultsOne', () => <ResultsList {...props} items={['chris']} />)
    .add('facebookResults', () => <ResultsList {...props} items={['chris-fb', 'cjb-fb', 'jzila-fb']} />)
    .add('noResults', () => <ResultsList {...props} items={[]} />)
    .add('connected', () => <ConnectedResultsList {...ownProps} />)
}

export default load
