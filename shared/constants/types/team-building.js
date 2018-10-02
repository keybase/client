// @flow strict
// $FlowIssue https://github.com/facebook/flow/issues/6628
import * as I from 'immutable'

export type FollowingState = 'Following' | 'NotFollowing' | 'NoState' | 'You'

// Use services from constants instead, here to avoid a circular dependency
export const _services = {
  contact: true,
  facebook: true,
  github: true,
  hackernews: true,
  keybase: true,
  pgp: true,
  reddit: true,
  twitter: true,
}

export type ServiceIdWithContact = $Keys<typeof _services>

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
type Query = string
export type SearchResults = I.Map<Query, I.Map<ServiceIdWithContact, Array<User>>>
export type ServiceResultCount = I.Map<SearchString, I.Map<ServiceIdWithContact, number>>

export type TeamBuildingSubState = {
  teamBuildingTeamSoFar: I.Set<User>,
  teamBuildingSearchResults: SearchResults,
  teamBuildingServiceResultCount: ServiceResultCount,
  teamBuildingFinishedTeam: I.Set<User>,
  teamBuildingSearchQuery: Query,
  teamBuildingSelectedService: ServiceIdWithContact,
  teamBuildingSearchLimit: number,
}

export type RawSearchResult = {
  score: number,
  keybase: ?{
    username: string,
    uid: string,
    picture_url: string,
    full_name: string,
    is_followee: boolean,
  },
  service: ?{
    service_name: ServiceIdWithContact,
    username: string,
    picture_url: string,
    bio: string,
    location: string,
    full_name: string,
  },
  services_summary: {
    [key: ServiceIdWithContact]: {
      service_name: ServiceIdWithContact,
      username: string,
    },
  },
}
