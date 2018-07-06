// @flow
import * as React from 'react'
import * as PropProviders from '../../stories/prop-providers'
import ResultRow, {type Props} from '.'
import ConnectedResultRow, {type OwnProps} from './container'
import {makeSearchResult} from '../../constants/search'
import {type SearchResultId, type SearchResult} from '../../constants/types/search'
import {Box} from '../../common-adapters'
import {isMobile} from '../../constants/platform'
import {storiesOf, action, createPropProvider} from '../../stories/storybook'

const defaultProps: Props = {
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

  onShowTracker: action('Show tracker'),
  onClick: action('On click'),
  onMouseOver: action('On mouse over'),
  selected: false,
  userIsInTeam: false,
}

const ownProps = {
  disableIfInTeamName: '',
  id: 'result',
  selected: false,
  onClick: action('On click'),
  onMouseOver: action('On mouse over'),
}

type SearchResultMap = {[id: SearchResultId]: ?SearchResult}

const defaultSearchResultMap = {
  result: {
    id: 'result',

    leftFullname: 'John Zila',
    leftIcon: null,
    leftService: 'Keybase',
    leftUsername: 'jzila',

    rightIcon: null,
    rightService: null,
    rightUsername: null,
  },
}

const mockOwnPropsToProps = (resultMap: SearchResultMap, ownProps: OwnProps): Props => {
  const result: SearchResult = resultMap[ownProps.id] || makeSearchResult()
  const leftFollowingState = 'NotFollowing'
  const rightFollowingState = 'NotFollowing'
  return {
    ...ownProps,
    ...result,
    leftFollowingState,
    rightFollowingState,
    userIsInTeam: false,
  }
}

const makeSelectorMap = (resultMap: SearchResultMap = defaultSearchResultMap) => ({
  SearchResultRow: ownProps => mockOwnPropsToProps(resultMap, ownProps),
})

const provider = createPropProvider(PropProviders.Common(), makeSelectorMap())

const load = () => {
  storiesOf('Search', module)
    .addDecorator(provider)
    .add('Result row', () => {
      return (
        <Box style={isMobile ? {} : {width: 480}}>
          <ResultRow {...defaultProps} />
          <ResultRow {...defaultProps} selected={true} />
          <ResultRow {...defaultProps} leftFollowingState="Following" />
          <ResultRow {...defaultProps} leftFollowingState="NotFollowing" />
          <ResultRow {...defaultProps} leftFollowingState="You" />
          <ResultRow {...defaultProps} onShowTracker={action('Show tracker')} />
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
