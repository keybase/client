// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Styles from '../../styles'
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
    leftIconOpaque: true,
    leftService: 'Keybase',
    leftUsername: 'chris',

    rightIcon: 'iconfont-identity-github',
    rightIconOpaque: true,
    rightService: 'GitHub',
    rightUsername: 'chrisname',

    leftFollowingState: 'Following',
    rightFollowingState: 'NoState',
    userAlreadySelected: false,
    userIsInTeam: false,
    userIsSelectable: true,
  },
  cjb: {
    leftFullname: 'cjb on facebook',
    leftIcon: null,
    leftIconOpaque: true,
    leftService: 'Keybase',
    leftUsername: 'cjb',

    rightIcon: 'iconfont-identity-facebook',
    rightIconOpaque: true,
    rightService: 'Facebook',
    rightUsername: 'cjbname',

    leftFollowingState: 'NotFollowing',
    rightFollowingState: 'NoState',
    userAlreadySelected: false,
    userIsInTeam: false,
    userIsSelectable: true,
  },
  jzila: {
    leftFullname: 'jzila on twitter',
    leftIcon: null,
    leftIconOpaque: true,
    leftService: 'Keybase',
    leftUsername: 'jzila',

    rightIcon: 'iconfont-identity-twitter',
    rightIconOpaque: true,
    rightService: 'Twitter',
    rightUsername: 'jzilatwit',

    leftFollowingState: 'NotFollowing',
    rightFollowingState: 'NoState',
    userAlreadySelected: false,
    userIsInTeam: false,
    userIsSelectable: true,
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
    .addDecorator(story => <Box style={{width: Styles.isMobile ? undefined : 420}}>{story()}</Box>)
    .add('keybaseResults', () => <ResultsList {...defaultProps} items={['chris', 'cjb', 'jzila']} />)
    .add('keybaseResultsOne', () => <ResultsList {...defaultProps} items={['chris']} />)
    .add('facebookResults', () => (
      <ResultsList {...defaultProps} items={['chris-fb', 'cjb-fb', 'jzila-fb']} />
    ))
    .add('noResults', () => <ResultsList {...defaultProps} items={[]} />)
    .add('connected', () => <ConnectedResultsList {...defaultOwnProps} />)
}

export default load
