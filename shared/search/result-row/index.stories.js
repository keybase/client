// @flow
import * as React from 'react'
import * as PropProviders from '../../stories/prop-providers'
import ResultRow from '.'
import {Box} from '../../common-adapters'
import {isMobile} from '../../constants/platform'
import {storiesOf, action} from '../../stories/storybook'

const commonRow = {
  id: 'result',
  onClick: action('On click'),
  onShowTracker: action('Show tracker'),
  selected: false,
  showTrackerButton: false,
  userIsInTeam: false,
}
const kbRow = {
  ...commonRow,
  leftFollowingState: 'NoState',
  leftFullname: 'John Zila',
  leftIcon: null,
  leftService: 'Keybase',
  leftUsername: 'jzila',
  rightFollowingState: 'NoState',
  rightIcon: null,
  rightService: null,
  rightUsername: null,
}

const serviceRow = {
  ...commonRow,
  leftFollowingState: 'NoState',
  leftFullname: 'John Zila',
  leftUsername: 'jzila',
  rightFollowingState: 'NoState',
  rightIcon: null,
  rightService: null,
  rightUsername: null,
}

const provider = PropProviders.composeAndCreate(
  PropProviders.Usernames(['max', 'cnojima', 'cdixon'], 'ayoubd'),
  PropProviders.Avatar(['following', 'both'], ['followers', 'both'])
)

const load = () => {
  storiesOf('Search', module)
    .addDecorator(provider)
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
            leftFullname="John Zila on GitHub"
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
}

export default load
