import logger from '../logger'
import * as I from 'immutable'
import * as Types from './types/team-building'
import * as RPCTypes from './types/rpc-gen'

const allServices: Array<Types.ServiceIdWithContact> = [
  'keybase',
  'contact',
  'twitter',
  'facebook',
  'github',
  'reddit',
  'hackernews',
  'pgp',
]

// We don't search pgp explicitly, and contact isn't implemented yet
const services: Array<Types.ServiceIdWithContact> = allServices.filter(s => s !== 'contact' && s !== 'pgp')

function isKeybaseUserId(userId: string) {
  // Only keybase user id's do not have
  return userId.indexOf('@') < 0
}

function followStateHelperWithId(
  me: string,
  followingState: I.Set<string>,
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
  teamBuildingFinishedTeam: I.Set(),
  teamBuildingSearchLimit: 11,
  teamBuildingSearchQuery: '',
  teamBuildingSearchResults: I.Map(),
  teamBuildingSelectedRole: 'writer',
  teamBuildingSelectedService: 'keybase',
  teamBuildingSendNotification: true,
  teamBuildingServiceResultCount: I.Map(),
  teamBuildingTeamSoFar: I.Set(),
  teamBuildingUserRecs: null,
})

const makeSubState = (): Types.TeamBuildingSubState => SubStateFactory()

const parseRawResultToUser = (
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
    return {
      id: result.contact.assertion,
      label: result.contact.displayLabel,
      prettyName: result.contact.displayName,
      serviceId: 'contact' as const,
      serviceMap: {...serviceMap, keybase: result.contact.username},
      username: result.contact.component.email || result.contact.component.phoneNumber || '',
    }
  } else if (result.imptofu) {
    return {
      id: result.imptofu.assertion,
      label: result.imptofu.label,
      prettyName: result.imptofu.prettyName,
      serviceId: 'contact' as const,
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

const selfToUser = (you: string): Types.User => ({
  id: you,
  prettyName: you,
  serviceId: 'keybase' as const,
  serviceMap: {},
  username: you,
})

const contactToUser = (contact: RPCTypes.ProcessedContact): Types.User => ({
  contact: true,
  id: contact.assertion,
  label: contact.displayLabel,
  prettyName: contact.displayName,
  serviceId: 'contact' as const,
  serviceMap: {keybase: contact.username},
  username: contact.component.email || contact.component.phoneNumber || '',
})

const interestingPersonToUser = (person: RPCTypes.InterestingPerson): Types.User => {
  const {username, fullname} = person
  return {
    id: username,
    prettyName: fullname,
    serviceId: 'keybase' as const,
    serviceMap: {keybase: username},
    username: username,
  }
}

export {
  followStateHelperWithId,
  makeSubState,
  allServices,
  services,
  parseRawResultToUser,
  selfToUser,
  contactToUser,
  interestingPersonToUser,
}
