import * as React from 'react'
import * as Sb from '../../stories/storybook'
import ResultRow, {Props} from '.'
import ConnectedResultRow, {OwnProps} from './container'
import {SearchResultId} from '../../constants/types/search'
import {Box} from '../../common-adapters'
import {isMobile} from '../../constants/platform'

export type ConnectProps = Exclude<Props, OwnProps>

const defaultConnectProps = {
  leftFollowingState: 'NoState',
  leftFullname: null,
  leftIcon: null,
  leftIconOpaque: true,
  leftService: 'Keybase',
  leftUsername: '',

  rightFollowingState: 'NoState',
  rightIcon: null,
  rightIconOpaque: true,
  rightService: null,
  rightUsername: null,

  userAlreadySelected: false,
  userIsInTeam: false,
  userIsSelectable: true,
}

export type ConnectPropsMap = {[K in SearchResultId]: ConnectProps | null}

const defaultConnectPropsMap: ConnectPropsMap = {
  jzila: {
    leftFollowingState: 'NotFollowing',
    leftFullname: 'John Zila',
    leftIcon: null,
    leftIconOpaque: true,
    leftService: 'Keybase',
    leftUsername: 'jzila',

    rightFollowingState: 'NotFollowing',
    rightIcon: null,
    rightIconOpaque: true,
    rightService: null,
    rightUsername: null,

    userAlreadySelected: false,
    userIsInTeam: false,
    userIsSelectable: true,
  },
} as any

const mockOwnPropsToProps = (connectPropsMap: ConnectPropsMap, ownProps: OwnProps): Props => {
  const result: any = connectPropsMap[ownProps.id] || defaultConnectProps
  return {
    ...ownProps,
    ...result,
  } as any
}

const defaultOwnProps: OwnProps = {
  disableIfInTeamName: '',
  id: 'jzila',
  onClick: Sb.action('On click'),
  onMouseOver: Sb.action('On mouse over'),
  searchKey: 'search key',
  selected: false,
}

const defaultProps = mockOwnPropsToProps(defaultConnectPropsMap, defaultOwnProps)

export const makeSelectorMap = (connectPropsMap: ConnectPropsMap = defaultConnectPropsMap) => ({
  SearchResultRow: (ownProps: OwnProps): Props => mockOwnPropsToProps(connectPropsMap, ownProps),
})

const provider = Sb.createPropProviderWithCommon(makeSelectorMap())

const onShowTracker = Sb.action('Show tracker')

const load = () => {
  Sb.storiesOf('Search', module)
    .addDecorator(provider)
    .addDecorator(Sb.scrollViewDecorator)
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
