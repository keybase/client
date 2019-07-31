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

export type RawSearchResult = {
  score: number
  keybase: {
    username: string
    uid: string
    picture_url: string
    full_name: string
    is_followee: boolean
  } | null
  service: {
    service_name: ServiceIdWithContact
    username: string
    picture_url: string
    bio: string
    location: string
    full_name: string
  } | null
  services_summary: {
    [K in ServiceIdWithContact]: {
      service_name: ServiceIdWithContact
      username: string
    }
  }
}
