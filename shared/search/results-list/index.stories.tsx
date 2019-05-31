import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Styles from '../../styles'
import ResultsList from '.'
import ConnectedResultsList, {OwnProps, Props} from './container'
import {Box} from '../../common-adapters'
import {
  ConnectPropsMap as RowConnectPropsMap,
  makeSelectorMap as makeRowSelectorMap,
} from '../result-row/index.stories'

const defaultConnectPropsMap: any = {
  chris: {
    leftFollowingState: 'Following',
    leftFullname: 'chris on GitHub',
    leftIcon: null,
    leftIconOpaque: true,
    leftService: 'Keybase',
    leftUsername: 'chris',

    rightFollowingState: 'NoState',
    rightIcon: 'iconfont-identity-github',
    rightIconOpaque: true,
    rightService: 'GitHub',
    rightUsername: 'chrisname',

    userAlreadySelected: false,
    userIsInTeam: false,
    userIsSelectable: true,
  },
  cjb: {
    leftFollowingState: 'NotFollowing',
    leftFullname: 'cjb on facebook',
    leftIcon: null,
    leftIconOpaque: true,
    leftService: 'Keybase',
    leftUsername: 'cjb',

    rightFollowingState: 'NoState',
    rightIcon: 'iconfont-identity-facebook',
    rightIconOpaque: true,
    rightService: 'Facebook',
    rightUsername: 'cjbname',

    userAlreadySelected: false,
    userIsInTeam: false,
    userIsSelectable: true,
  },
  jzila: {
    leftFollowingState: 'NotFollowing',
    leftFullname: 'jzila on twitter',
    leftIcon: null,
    leftIconOpaque: true,
    leftService: 'Keybase',
    leftUsername: 'jzila',

    rightFollowingState: 'NoState',
    rightIcon: 'iconfont-identity-twitter',
    rightIconOpaque: true,
    rightService: 'Twitter',
    rightUsername: 'jzilatwit',

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
    items: Object.keys(rowConnectPropsMap),
    onMouseOver,
    pending: false,
    selectedId: null,
    showSearchSuggestions: false,
  } as Props
}

const defaultOwnProps: OwnProps = {
  disableIfInTeamName: '',
  onClick: Sb.action('onClick'),
  onShowTracker: Sb.action('onShowTracker'),
  searchKey: 'search-key',
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
