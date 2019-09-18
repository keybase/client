import logger from '../logger'
import * as I from 'immutable'
import * as Types from './types/team-building'
import * as RPCTypes from './types/rpc-gen'

const searchServices: Array<Types.ServiceId> = [
  'keybase',
  'twitter',
  'facebook',
  'github',
  'reddit',
  'hackernews',
]
// Order here determines order of tabs in team building
export const allServices: Array<Types.ServiceIdWithContact> = [
  ...searchServices.slice(0, 1),
  'phone',
  'email',
  ...searchServices.slice(1),
]

function isKeybaseUserId(userId: string) {
  // Only keybase user id's do not have
  return userId.indexOf('@') < 0
}

export function followStateHelperWithId(
  me: string,
  followingState: Set<string>,
  userId: string = ''
): Types.FollowingState {
  if (isKeybaseUserId(userId)) {
    if (userId === me) {
      return 'You'
    } else {
      return followingState.has(userId) ? 'Following' : 'NotFollowing'
    }
  }
  return 'NoState'
}

const SubStateFactory = I.Record<Types._TeamBuildingSubState>({
  teamBuildingFinishedSelectedRole: 'writer',
  teamBuildingFinishedSendNotification: true,
  teamBuildingFinishedTeam: I.OrderedSet(),
  teamBuildingSearchLimit: 11,
  teamBuildingSearchQuery: '',
  teamBuildingSearchResults: I.Map(),
  teamBuildingSelectedRole: 'writer',
  teamBuildingSelectedService: 'keybase',
  teamBuildingSendNotification: true,
  teamBuildingServiceResultCount: I.Map(),
  teamBuildingTeamSoFar: I.OrderedSet(),
  teamBuildingUserRecs: null,
})

export const makeSubState = (): Types.TeamBuildingSubState => SubStateFactory()

export const parseRawResultToUser = (
  result: RPCTypes.APIUserSearchResult,
  service: Types.ServiceIdWithContact
): Types.User | null => {
  const serviceMap = Object.keys(result.servicesSummary || {}).reduce<{[key: string]: string}>(
    (acc, service_name) => {
      acc[service_name] = result.servicesSummary[service_name].username
      return acc
    },
    {}
  )

  // Add the keybase service to the service map since it isn't there by default
  if (result.keybase) {
    serviceMap['keybase'] = result.keybase.username
  }

  if (service === 'keybase' && result.keybase) {
    return {
      id: result.keybase.username,
      prettyName: result.keybase.fullName || result.keybase.username,
      serviceId: 'keybase' as const,
      serviceMap,
      username: result.keybase.username,
    }
  } else if (service === 'keybase' && result.contact) {
    const serviceId = result.contact.component.phoneNumber ? 'phone' : 'email'
    return {
      contact: true,
      id: result.contact.assertion,
      label: result.contact.displayLabel,
      prettyName: result.contact.displayName,
      serviceId,
      serviceMap: {...result.contact.serviceMap, keybase: result.contact.username},
      username: result.contact.component.email || result.contact.component.phoneNumber || '',
    }
  } else if (result.imptofu) {
    const serviceId = result.imptofu.assertionKey === 'phone' ? 'phone' : 'email'
    return {
      id: result.imptofu.assertion,
      label: result.imptofu.label,
      prettyName: result.imptofu.prettyName,
      serviceId,
      serviceMap: {...serviceMap, keybase: result.imptofu.keybaseUsername},
      username: result.imptofu.assertionValue,
    }
  } else if (result.service) {
    if (result.service.serviceName !== service) {
      // This shouldn't happen
      logger.error(
        `Search result's service_name is different than given service name. Expected: ${service} received ${
          result.service.serviceName
        }`
      )
      return null
    }

    const kbPrettyName = result.keybase && (result.keybase.fullName || result.keybase.username)

    const prettyName = result.service.fullName || kbPrettyName || ''

    let id = `${result.service.username}@${result.service.serviceName}`
    if (result.keybase) {
      // If it's also a keybase user, make a compound assertion.
      id += `+${result.keybase.username}`
    }

    return {
      id,
      prettyName,
      serviceId: service,
      serviceMap,
      username: result.service.username,
    }
  } else {
    return null
  }
}

export const selfToUser = (you: string): Types.User => ({
  id: you,
  prettyName: you,
  serviceId: 'keybase' as const,
  serviceMap: {},
  username: you,
})

export const contactToUser = (contact: RPCTypes.ProcessedContact): Types.User => ({
  contact: true,
  id: contact.assertion,
  label: contact.displayLabel,
  prettyName: contact.displayName,
  serviceId: contact.component.phoneNumber ? 'phone' : 'email',
  serviceMap: {keybase: contact.username},
  username: contact.component.email || contact.component.phoneNumber || '',
})

export const interestingPersonToUser = (person: RPCTypes.InterestingPerson): Types.User => {
  const {username, fullname} = person
  return {
    id: username,
    prettyName: fullname,
    serviceId: 'keybase' as const,
    serviceMap: {keybase: username},
    username: username,
  }
}

export const searchWaitingKey = 'teamBuilding:search'
