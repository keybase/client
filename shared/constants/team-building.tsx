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

const services: Array<Types.ServiceIdWithContact> = allServices.filter(s => s !== 'contact' && s !== 'pgp')

function followStateHelperWithId(
  me: string,
  followingState: I.Set<string>,
  user: Types.User
): Types.FollowingState {
  const {keybaseUsername} = user
  if (keybaseUsername) {
    if (keybaseUsername === me) {
      return 'You'
    } else {
      return followingState.has(keybaseUsername) ? 'Following' : 'NotFollowing'
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

const resultSourceToService = (source: RPCTypes.UserSearchSource): Types.ServiceIdWithContact => {
  switch (source.t) {
    case RPCTypes.UserSearchSourceType.contacts:
    case RPCTypes.UserSearchSourceType.tofu:
      return 'contact'
    case RPCTypes.UserSearchSourceType.social:
      return source.social as Types.ServiceIdWithContact
    case RPCTypes.UserSearchSourceType.keybase:
      return 'keybase'
  }
}

const parseRawResultToUser = (result: RPCTypes.UserSearchResult): Types.User => {
  return {
    assertion: result.assertion,
    bubbleText: result.bubbleText,
    id: result.id,
    keybaseUsername: result.keybaseUsername,
    label: result.label,
    prettyName: result.prettyName,
    serviceMap: result.serviceMap || {},
    serviceName: resultSourceToService(result.source),
    username: result.username,
  }
}

const userToSelectedUser = (user: Types.User): Types.SelectedUser => {
  return {
    description: user.bubbleText,
    service: user.serviceName,
    title: user.prettyName,
    userId: user.id,
    usernameForAvatar: user.keybaseUsername,
  }
}

// Used whenever something wants to launch team-building dialog with current
// user in it.
const selfToUser = (you: string): Types.User => ({
  assertion: you,
  bubbleText: `You, ${you}`,
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
  resultSourceToService,
}
