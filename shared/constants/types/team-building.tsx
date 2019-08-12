import * as I from 'immutable'
import {TeamRoleType} from './teams'
import {ServiceId} from '../../util/platforms'

export type AllowedNamespace = 'chat2' | 'teams'
export type FollowingState = 'Following' | 'NotFollowing' | 'NoState' | 'You'

export type ServiceIdWithContact = ServiceId | 'contact'

export type SearchString = string
type UsernameOnService = string
export type ServiceMap = {[K in ServiceIdWithContact]?: UsernameOnService}

export type User = {
  serviceMap: ServiceMap
  id: string // unique, key for user lists
  // username for given service, keybase username if keybase. e164 (w/o '+')
  // for phone number, email for emails.
  username: string
  serviceName: ServiceIdWithContact
  assertion: string
  prettyName: string
  label: string
  // a phone / email from our contacts, can also be a keybase user (will have
  // keybase entry in serviceMap)
  contact?: boolean
}

// Used in the team-building user bubbles
export type SelectedUser = {
  userId: string
  title: string
  description: string // displayed on hover
  usernameForAvatar?: string
  service: ServiceIdWithContact // needed for default icons
}

// Treating this as a tuple
export type SearchKey = I.List<SearchString | ServiceIdWithContact>

// This is what should be kept in the reducer
// Keyed so that we never get results that don't match the user's input (e.g. outdated results)
type Query = string

export type SearchResults = I.Map<Query, I.Map<ServiceIdWithContact, Array<User>>>
export type ServiceResultCount = I.Map<SearchString, I.Map<ServiceIdWithContact, number>>

// TODO remove teamBuilding prefix
export type _TeamBuildingSubState = {
  teamBuildingTeamSoFar: I.Set<User>
  teamBuildingSearchResults: SearchResults
  teamBuildingServiceResultCount: ServiceResultCount
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
