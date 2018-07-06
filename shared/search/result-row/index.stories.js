// @flow
import * as React from 'react'
import * as PropProviders from '../../stories/prop-providers'
import ResultRow, {type Props} from '.'
import ConnectedResultRow, {type OwnProps} from './container'
import {type SearchResultId} from '../../constants/types/search'
import {Box} from '../../common-adapters'
import {isMobile} from '../../constants/platform'
import {storiesOf, action, createPropProvider} from '../../stories/storybook'

export type ConnectProps = $Exact<$Diff<Props, OwnProps>>

const defaultConnectProps = {
  leftFullname: null,
  leftIcon: null,
  leftService: 'Keybase',
  leftUsername: '',

  rightIcon: null,
  rightService: null,
  rightUsername: null,

  leftFollowingState: 'NoState',
  rightFollowingState: 'NoState',
  userIsInTeam: false,
}

export type ConnectPropsMap = {[id: SearchResultId]: ?ConnectProps}

const defaultConnectPropsMap: ConnectPropsMap = {
  jzila: {
    leftFullname: 'John Zila',
    leftIcon: null,
    leftService: 'Keybase',
    leftUsername: 'jzila',

    rightIcon: null,
    rightService: null,
    rightUsername: null,

    leftFollowingState: 'NotFollowing',
    rightFollowingState: 'NotFollowing',
    userIsInTeam: false,
  },
}

const mockOwnPropsToProps = (connectPropsMap: ConnectPropsMap, ownProps: OwnProps): Props => {
  const result: ConnectProps = connectPropsMap[ownProps.id] || defaultConnectProps
  return {
    ...ownProps,
    ...result,
  }
}

const defaultOwnProps: OwnProps = {
  disableIfInTeamName: '',
  id: 'jzila',
  selected: false,
  onClick: action('On click'),
  onMouseOver: action('On mouse over'),
}

const defaultProps = mockOwnPropsToProps(defaultConnectPropsMap, defaultOwnProps)

export const makeSelectorMap = (connectPropsMap: ConnectPropsMap = defaultConnectPropsMap) => ({
  SearchResultRow: (ownProps: OwnProps): Props => mockOwnPropsToProps(connectPropsMap, ownProps),
})

const provider = createPropProvider(PropProviders.Common(), makeSelectorMap())

const onShowTracker = action('Show tracker')

const load = () => {
  storiesOf('Search', module)
    .addDecorator(provider)
    .addDecorator(story => <Box style={isMobile ? {} : {width: 480}}>{story()}</Box>)

    .add('Result row', () => (
      <React.Fragment>
        <ResultRow {...defaultProps} />
        <ResultRow {...defaultProps} selected={true} />
        <ResultRow {...defaultProps} leftFollowingState="Following" />
        <ResultRow {...defaultProps} leftFollowingState="NotFollowing" />
        <ResultRow {...defaultProps} leftFollowingState="You" />
        <ResultRow {...defaultProps} onShowTracker={onShowTracker} />
        <ResultRow
          {...defaultProps}
          leftFullname="John Zila on GitHub"
          rightIcon="iconfont-identity-github"
          rightService="GitHub"
          rightUsername="jzilagithub"
        />
        <ResultRow
          {...defaultProps}
          rightIcon="iconfont-identity-github"
          rightService="GitHub"
          rightUsername="jzilagithub"
        />
        <ResultRow {...defaultProps} leftIcon="icon-twitter-logo-24" leftService="Twitter" />
        <ResultRow
          {...defaultProps}
          leftIcon="icon-twitter-logo-24"
          leftService="Twitter"
          rightService="Keybase"
          rightUsername="jzila"
        />
        <ResultRow
          {...defaultProps}
          leftIcon="icon-twitter-logo-24"
          leftService="Twitter"
          rightFollowingState="Following"
          rightService="Keybase"
          rightUsername="jzila"
        />
        <ResultRow
          {...defaultProps}
          leftIcon="icon-twitter-logo-24"
          leftService="Twitter"
          rightFollowingState="NotFollowing"
          rightService="Keybase"
          rightUsername="jzila"
        />
        <ResultRow
          {...defaultProps}
          leftIcon="icon-twitter-logo-24"
          leftService="Twitter"
          rightFollowingState="You"
          rightService="Keybase"
          rightUsername="jzila"
        />
        <ResultRow {...defaultProps} leftIcon="icon-facebook-logo-24" leftService="Facebook" />
        <ResultRow {...defaultProps} leftIcon="icon-github-logo-24" leftService="GitHub" />
        <ResultRow {...defaultProps} leftIcon="icon-reddit-logo-24" leftService="Reddit" />
        <ResultRow {...defaultProps} leftIcon="icon-hacker-news-logo-24" leftService="Hacker News" />
      </React.Fragment>
    ))
    .add('Result row (connected)', () => (
      <ConnectedResultRow {...defaultOwnProps} onShowTracker={onShowTracker} />
    ))
}

export default load
