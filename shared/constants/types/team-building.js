// @flow strict
// $FlowIssue https://github.com/facebook/flow/issues/6628
import * as I from 'immutable'

export type FollowingState = 'Following' | 'NotFollowing' | 'NoState' | 'You'
export type ServiceIdWithContact =
  | 'facebook'
  | 'github'
  | 'hackernews'
  | 'keybase'
  | 'pgp'
  | 'reddit'
  | 'twitter'
  | 'contact'

export type SearchString = string
type UsernameOnService = string
export type UserID = string // for keybase would be `marcopolo` for other services would be `notonkb@reddit`
export type ServiceMap = {[key: ServiceIdWithContact]: UsernameOnService}

export type User = {
  serviceMap: ServiceMap,
  id: UserID,
  prettyName: string,
}

// Treating this as a tuple
export type SearchKey = I.List<SearchString | ServiceIdWithContact>
// This is what should be kept in the reducer
// Keyed so that we never get results that don't match the user's input (e.g. outdated results)
export type SearchResults = I.Map<SearchKey, Array<User>>
export type ServiceResultCount = I.Map<SearchString, I.Map<ServiceIdWithContact, number>>

export type TeamBuildingSubState = {
  teamBuildingTeamSoFar: I.Set<User>,
  teamBuildingSearchResults: SearchResults,
  teamBuildingServiceResultCount: ServiceResultCount,
  teamBuildingFinishedTeam: I.Set<User>,
}
