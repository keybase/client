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

const parseRawResultToUser = (result: RPCTypes.UserSearchResult): Types.User => {
  return {
    assertion: result.assertion,
    id: result.id,
    label: result.label,
    prettyName: result.prettyName,
    serviceMap: result.serviceMap,
    serviceName: result.serviceName,
    username: result.username,
  }
}

export {followStateHelperWithId, makeSubState, allServices, services, parseRawResultToUser}
