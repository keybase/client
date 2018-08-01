// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import ResultsList from '.'
import ConnectedResultsList, {type OwnProps, type Props} from './container'
import {Box} from '../../common-adapters'
import {
  type ConnectPropsMap as RowConnectPropsMap,
  makeSelectorMap as makeRowSelectorMap,
} from '../result-row/index.stories'

const defaultConnectPropsMap: RowConnectPropsMap = {
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

Object.keys(defaultConnectPropsMap).forEach(id => {
  defaultConnectPropsMap[id + '-fb'] = {
    ...defaultConnectPropsMap[id],
    leftFollowingState: 'NoState',
    leftIcon: 'icon-facebook-logo-24',
    leftService: 'Facebook',
  }
})

const onMouseOver = Sb.action('onMouseOver')

// Can extend to vary items based on ownProps.searchKey if needed.
const mockOwnPropsToProps = (rowConnectPropsMap: RowConnectPropsMap, ownProps: OwnProps): Props => {
  return {
    ...ownProps,
    pending: false,
    items: Object.keys(rowConnectPropsMap),
    onMouseOver,
    selectedId: null,
    showSearchSuggestions: false,
  }
}

const defaultOwnProps: OwnProps = {
  searchKey: 'search-key',
  onShowTracker: Sb.action('onShowTracker'),
  onClick: Sb.action('onClick'),
  disableIfInTeamName: '',
}

const defaultProps = mockOwnPropsToProps(defaultConnectPropsMap, defaultOwnProps)

export const makeSelectorMap = (rowConnectPropsMap: RowConnectPropsMap = defaultConnectPropsMap) => ({
  ...makeRowSelectorMap(rowConnectPropsMap),
  ResultsList: (ownProps: OwnProps) => mockOwnPropsToProps(rowConnectPropsMap, ownProps),
})

const provider = Sb.createPropProviderWithCommon(makeSelectorMap())

const load = () => {
  Sb.storiesOf('Search/ResultsList', module)
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
