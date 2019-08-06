import * as I from 'immutable'
import {TeamRoleType} from './teams'
import {ServiceId} from '../../util/platforms'

export type AllowedNamespace = 'chat2' | 'teams'
export type FollowingState = 'Following' | 'NotFollowing' | 'NoState' | 'You'

export type ServiceIdWithContact = ServiceId | 'contact'

export type SearchString = string
type UsernameOnService = string
export type UserID = string // for keybase would be `marcopolo` for other services would be `notonkb@reddit`
export type ServiceMap = {[K in ServiceIdWithContact]?: UsernameOnService}

export type User = {
  serviceMap: ServiceMap
  id: UserID
  prettyName: string
  label?: string
  contact?: boolean // not a keybase user, a phone / email from our contacts
}

// Treating this as a tuple
export type SearchKey = I.List<SearchString | ServiceIdWithContact>

// This is what should be kept in the reducer
// Keyed so that we never get results that don't match the user's input (e.g. outdated results)
type Query = string

export type SearchResultsForQuery = {
  users: Array<User>
  hasMore: boolean
}

export type SearchResults = I.Map<Query, I.Map<ServiceIdWithContact, SearchResultsForQuery>>

// TODO remove teamBuilding prefix
export type _TeamBuildingSubState = {
  teamBuildingTeamSoFar: I.Set<User>
  teamBuildingSearchHasMore: boolean
  teamBuildingSearchResults: SearchResults
  teamBuildingFinishedTeam: I.Set<User>
  teamBuildingFinishedSelectedRole: TeamRoleType
  teamBuildingFinishedSendNotification: boolean
  teamBuildingSearchQuery: Query
  teamBuildingSelectedService: ServiceIdWithContact
  teamBuildingSearchLimit: number
  teamBuildingUserRecs: Array<User> | null
  teamBuildingSelectedRole: TeamRoleType
  teamBuildingSendNotification: boolean
}

export type TeamBuildingSubState = I.RecordOf<_TeamBuildingSubState>
