import {IconType} from '../../common-adapters/icon.constants'
export type Service = 'Facebook' | 'GitHub' | 'Hacker News' | 'Keybase' | 'Reddit' | 'Twitter'

export type FollowingState = 'Following' | 'NotFollowing' | 'NoState' | 'You'

// This is what the api expects/returns
export type SearchPlatform = 'Keybase' | 'Twitter' | 'Github' | 'Reddit' | 'Hackernews' | 'Pgp' | 'Facebook'

export type SearchResultId = string // i.e. marcopolo or marcopolo@github
export type SearchQuery = string

export type RowProps = {
  id: SearchResultId
  leftFollowingState: FollowingState
  leftFullname: string | null
  leftIcon: IconType | null // If service is keybase this can be null,
  leftIconOpaque: boolean
  leftService: Service
  leftUsername: string
  rightFollowingState: FollowingState
  rightIcon: IconType | null
  rightIconOpaque: boolean
  rightService: Service | null
  rightUsername: string | null
  onShowTracker: () => void
  onClick: () => void
  onMouseOver?: () => void
  selected: boolean
  searchKey: string
  userAlreadySelected: boolean
  userIsInTeam: boolean
  userIsSelectable: boolean
}

// A normalized version of the row props above.
// The connector should fill in the missing pieces like the following state
export type SearchResult = {
  id: SearchResultId
  leftFullname: string | null
  leftIcon: IconType | null // If service is keybase this can be null,
  leftService: Service
  leftUsername: string
  rightIcon: IconType | null
  rightService: Service | null
  rightUsername: string | null
}
