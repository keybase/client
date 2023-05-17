import type * as Types from './types/team-building'

const searchServices: Array<Types.ServiceId> = ['keybase', 'twitter', 'github', 'reddit', 'hackernews']

// Order here determines order of tabs in team building
export const allServices: Array<Types.ServiceIdWithContact> = [
  ...searchServices.slice(0, 1),
  'phone',
  'email',
  ...searchServices.slice(1),
]

export const makeSubState = (): Types.TeamBuildingSubState => ({
  error: '',
  finishedSelectedRole: 'writer',
  finishedSendNotification: true,
  finishedTeam: new Set(),
  searchLimit: 11,
  searchQuery: '',
  searchResults: new Map(),
  selectedRole: 'writer',
  selectedService: 'keybase',
  sendNotification: true,
  serviceResultCount: new Map(),
  teamSoFar: new Set(),
})

export const selfToUser = (you: string): Types.User => ({
  id: you,
  prettyName: you,
  serviceId: 'keybase' as const,
  serviceMap: {},
  username: you,
})

export const searchWaitingKey = 'teamBuilding:search'
