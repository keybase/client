// @flow
import * as React from 'react'
import * as PropProviders from '../../stories/prop-providers'
import ResultRow, {type Props} from '.'
import ConnectedResultRow, {type OwnProps} from './container'
import {Box} from '../../common-adapters'
import {isMobile} from '../../constants/platform'
import {storiesOf, action, createPropProvider} from '../../stories/storybook'

const defaultRow: Props = {
  id: 'result',

  leftFollowingState: 'NoState',
  leftFullname: 'John Zila',
  leftIcon: null,
  leftService: 'Keybase',
  leftUsername: 'jzila',

  rightFollowingState: 'NoState',
  rightIcon: null,
  rightService: null,
  rightUsername: null,

  showTrackerButton: false,
  onShowTracker: action('Show tracker'),
  onClick: action('On click'),
  onMouseOver: action('On mouse over'),
  selected: false,
  userIsInTeam: false,
}

const ownProps = {
  disableIfInTeamName: '',
  id: 'result',
  onClick: action('On click'),
  onMouseOver: action('On click'),
  onShowTracker: action('Show tracker'),
}

const mockOwnPropsToProps = (ownProps: OwnProps): Props => {
  const result = defaultRow
  const leftFollowingState = 'NotFollowing'
  const rightFollowingState = 'NotFollowing'
  return {
    ...result,
    onClick: ownProps.onClick,
    onMouseOver: ownProps.onMouseOver,
    onShowTracker: ownProps.onShowTracker,
    showTrackerButton: !!ownProps.onShowTracker,
    leftFollowingState,
    rightFollowingState,
    userIsInTeam: false,
  }
}

const provider = createPropProvider(PropProviders.Common(), {
  SearchResultRow: mockOwnPropsToProps,
})

const load = () => {
  storiesOf('Search', module)
    .addDecorator(provider)
    .add('Result row', () => {
      return (
        <Box style={isMobile ? {} : {width: 480}}>
          <ResultRow {...defaultRow} />
          <ResultRow {...defaultRow} selected={true} />
          <ResultRow {...defaultRow} leftFollowingState="Following" />
          <ResultRow {...defaultRow} leftFollowingState="NotFollowing" />
          <ResultRow {...defaultRow} leftFollowingState="You" />
          <ResultRow {...defaultRow} showTrackerButton={true} />
          <ResultRow
            {...defaultRow}
            leftFullname="John Zila on GitHub"
            rightIcon="iconfont-identity-github"
            rightService="GitHub"
            rightUsername="jzilagithub"
          />
          <ResultRow
            {...defaultRow}
            rightIcon="iconfont-identity-github"
            rightService="GitHub"
            rightUsername="jzilagithub"
          />
          <ResultRow {...defaultRow} leftIcon="icon-twitter-logo-24" leftService="Twitter" />
          <ResultRow
            {...defaultRow}
            leftIcon="icon-twitter-logo-24"
            leftService="Twitter"
            rightService="Keybase"
            rightUsername="jzila"
          />
          <ResultRow
            {...defaultRow}
            leftIcon="icon-twitter-logo-24"
            leftService="Twitter"
            rightFollowingState="Following"
            rightService="Keybase"
            rightUsername="jzila"
          />
          <ResultRow
            {...defaultRow}
            leftIcon="icon-twitter-logo-24"
            leftService="Twitter"
            rightFollowingState="NotFollowing"
            rightService="Keybase"
            rightUsername="jzila"
          />
          <ResultRow
            {...defaultRow}
            leftIcon="icon-twitter-logo-24"
            leftService="Twitter"
            rightFollowingState="You"
            rightService="Keybase"
            rightUsername="jzila"
          />
          <ResultRow {...defaultRow} leftIcon="icon-facebook-logo-24" leftService="Facebook" />
          <ResultRow {...defaultRow} leftIcon="icon-github-logo-24" leftService="GitHub" />
          <ResultRow {...defaultRow} leftIcon="icon-reddit-logo-24" leftService="Reddit" />
          <ResultRow {...defaultRow} leftIcon="icon-hacker-news-logo-24" leftService="Hacker News" />
        </Box>
      )
    })
    .add('Result row (connected)', () => {
      return (
        <Box style={isMobile ? {} : {width: 480}}>
          <ConnectedResultRow {...ownProps} />
        </Box>
      )
    })
}

export default load
