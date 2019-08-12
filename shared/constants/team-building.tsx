import * as I from 'immutable'
import * as Types from './types/team-building'
import * as RPCTypes from './types/rpc-gen'
import {capitalize} from 'lodash-es'

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
    keybaseUsername: result.keybaseUsername,
    label: result.label,
    prettyName: result.prettyName,
    serviceMap: result.serviceMap,
    serviceName: result.serviceName as Types.ServiceIdWithContact,
    username: result.username,
  }
}

const userToSelectedUser = (user: Types.User): Types.SelectedUser => {
  let technicalName: string
  switch (user.serviceName) {
    case 'keybase':
    case 'contact':
      technicalName = user.username
      break
    default:
      technicalName = `${user.username} on ${capitalize(user.serviceName)}`
      break
  }
  const description = `${technicalName} ${user.prettyName ? `(${user.prettyName})` : ''}`
  return {
    description,
    service: user.serviceName,
    title: user.username,
    userId: user.id,
    usernameForAvatar: user.keybaseUsername,
  }
}

// Used whenever something wants to launch team-building dialog with current
// user in it.
const selfToUser = (you: string): Types.User => ({
  assertion: you,
  id: you,
  label: '',
  prettyName: you,
  serviceMap: {},
  serviceName: 'keybase' as const,
  username: you,
})

export {
  followStateHelperWithId,
  makeSubState,
  allServices,
  services,
  parseRawResultToUser,
  userToSelectedUser,
  selfToUser,
}
