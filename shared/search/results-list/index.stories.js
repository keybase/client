// @flow
import * as React from 'react'
import ResultsList from '.'
import ConnectedResultsList, {type OwnProps, type Props} from './container'
import {Box} from '../../common-adapters'
import {storiesOf, action, createPropProvider} from '../../stories/storybook'
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

const onMouseOver = action('onMouseOver')

// Can extend to vary items based on ownProps.searchKey if needed.
const mockOwnPropsToProps = (ownProps: OwnProps): Props => {
  return {
    ...ownProps,
    pending: false,
    items: Object.keys(connectPropsMap),
    onMouseOver,
    selectedId: null,
    showSearchSuggestions: false,
  }
}

const defaultOwnProps: OwnProps = {
  searchKey: 'search-key',
  onShowTracker: action('onShowTracker'),
  onClick: action('onClick'),
  disableIfInTeamName: '',
}

const defaultProps = mockOwnPropsToProps(defaultOwnProps)

export const makeSelectorMap = () => ({
  ...makeRowSelectorMap(connectPropsMap),
  ResultsList: mockOwnPropsToProps,
})

const provider = createPropProvider(makeSelectorMap())

const load = () => {
  storiesOf('Search/ResultsList', module)
    .addDecorator(provider)
    .addDecorator(story => <Box style={{width: 420}}>{story()}</Box>)
    .add('keybaseResults', () => <ResultsList {...defaultProps} items={['chris', 'cjb', 'jzila']} />)
    .add('keybaseResultsOne', () => <ResultsList {...defaultProps} items={['chris']} />)
    .add('facebookResults', () => (
      <ResultsList {...defaultProps} items={['chris-fb', 'cjb-fb', 'jzila-fb']} />
    ))
    .add('noResults', () => <ResultsList {...defaultProps} items={[]} />)
    .add('connected', () => <ConnectedResultsList {...defaultOwnProps} />)
}

export default load
