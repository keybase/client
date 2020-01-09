import {TeamRoleType} from './teams'
import {ServiceId as _ServiceId} from '../../util/platforms'

export const allowedNamespace = ['chat2', 'crypto', 'teams', 'people', 'wallets'] as const
export type AllowedNamespace = typeof allowedNamespace[number]
export type FollowingState = 'Following' | 'NotFollowing' | 'NoState' | 'You'
export type ServiceId = _ServiceId

export type ContactServiceId = 'email' | 'phone'
// These are the possible tabs in team building, and also consts that can be
// passed as `service` to search RPC (`userSearch.UserSearch`).
export type ServiceIdWithContact = _ServiceId | ContactServiceId

export const isContactServiceId = (id: string): id is ContactServiceId => id === 'email' || id === 'phone'

export type SearchString = string
type UsernameOnService = string
export type UserID = string // for keybase would be `marcopolo` for other services would be `notonkb@reddit`
export type ServiceMap = {[K in ServiceIdWithContact]?: UsernameOnService}

export type User = {
  serviceMap: ServiceMap
  id: UserID // unique key for user result, also assertion to use for new chat / adding to a team
  username: string // username on service (or keybase username if service is keybase)
  serviceId: ServiceIdWithContact
  prettyName: string
  label?: string
  contact?: boolean // not a keybase user, a phone / email from our contacts
}

// Treating this as a tuple
export type SearchKey = Array<SearchString | ServiceIdWithContact>

// This is what should be kept in the reducer
// Keyed so that we never get results that don't match the user's input (e.g. outdated results)
type Query = string

export type SearchResults = Map<Query, Map<ServiceIdWithContact, Array<User>>>
export type ServiceResultCount = Map<SearchString, Map<ServiceIdWithContact, number>>

export type TeamBuildingSubState = Readonly<{
  error: string
  teamSoFar: Set<User>
  searchResults: SearchResults
  serviceResultCount: ServiceResultCount
  finishedTeam: Set<User>
  finishedSelectedRole: TeamRoleType
  finishedSendNotification: boolean
  searchQuery: Query
  selectedService: ServiceIdWithContact
  searchLimit: number
  userRecs?: Array<User>
  selectedRole: TeamRoleType
  sendNotification: boolean
}>

export type SelectedUser = {
  userId: string
  prettyName: string
  username: string
  service: ServiceIdWithContact
}
