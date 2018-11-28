// @flow
import logger from '../logger'
import * as I from 'immutable'
import * as Types from './types/team-building'

const allServices: Array<Types.ServiceIdWithContact> = Object.keys(Types._services)
// We don't search pgp explicitly, and contact isn't implemented yet
const services: Array<Types.ServiceIdWithContact> = allServices.filter(s => s !== 'contact' && s !== 'pgp')

function isKeybaseUserId(userId) {
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

const makeSubState = (): $Exact<Types.TeamBuildingSubState> => ({
  teamBuildingTeamSoFar: I.Set(),
  teamBuildingSearchResults: I.Map(),
  teamBuildingServiceResultCount: I.Map(),
  teamBuildingFinishedTeam: I.Set(),
  teamBuildingSearchQuery: '',
  teamBuildingSelectedService: 'keybase',
  teamBuildingSearchLimit: 11,
  teamBuildingUserRecs: [],
})

const parseRawResultToUser = (
  result: Types.RawSearchResult,
  service: Types.ServiceIdWithContact
): ?Types.User => {
  const serviceMap = Object.keys(result.services_summary || {}).reduce((acc, service_name) => {
    acc[service_name] = result.services_summary[service_name].username
    return acc
  }, {})

  // Add the keybase service to the service map since it isn't there by default
  if (result.keybase) {
    serviceMap['keybase'] = result.keybase.username
  }

  if (service === 'keybase' && result.keybase) {
    return {
      serviceMap,
      id: result.keybase.username,
      prettyName: result.keybase.full_name || result.keybase.username,
    }
  } else if (result.service) {
    if (result.service.service_name !== service) {
      // This shouldn't happen
      logger.error(
        `Search result's service_name is different than given service name. Expected: ${service} received ${
          result.service.service_name
        }`
      )
      return null
    }

    const kbPrettyName = result.keybase && (result.keybase.full_name || result.keybase.username)

    const prettyName =
      result.service.full_name ||
      kbPrettyName ||
      `${result.service.username} on ${result.service.service_name}`

    const id = result.keybase
      ? result.keybase.username
      : `${result.service.username}@${result.service.service_name}`

    return {
      serviceMap,
      id,
      prettyName,
    }
  } else {
    return null
  }
}

export {followStateHelperWithId, makeSubState, allServices, services, parseRawResultToUser}
