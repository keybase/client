// @flow
import {type IconType} from '../../common-adapters/icon'
export type Service = 'Facebook' | 'GitHub' | 'Hacker News' | 'Keybase' | 'Reddit' | 'Twitter'

export type FollowingState = 'Following' | 'NotFollowing' | 'NoState' | 'You'

// This is what the api expects/returns
export type SearchPlatform = 'Keybase' | 'Twitter' | 'Github' | 'Reddit' | 'Hackernews' | 'Pgp' | 'Facebook'

export type SearchResultId = string // i.e. marcopolo or marcopolo@github
export type SearchQuery = string

export type RowProps = {
  id: SearchResultId,

  leftFollowingState: FollowingState,
  leftFullname: ?string,
  leftIcon: ?IconType, // If service is keybase this can be null
  leftService: Service,
  leftUsername: string,

  rightFollowingState: FollowingState,
  rightIcon: ?IconType,
  rightService: ?Service,
  rightUsername: ?string,

  showTrackerButton: boolean,
  onShowTracker: () => void,
  onClick: () => void,
  onMouseOver?: () => void,
  selected: boolean,
  userIsInTeam: boolean,
}
// A normalized version of the row props above.
// The connector should fill in the missing pieces like the following state
export type SearchResult = {
  id: SearchResultId,

  leftFullname: ?string,
  leftIcon: ?IconType, // If service is keybase this can be null
  leftService: Service,
  leftUsername: string,

  rightIcon: ?IconType,
  rightService: ?Service,
  rightUsername: ?string,
}
