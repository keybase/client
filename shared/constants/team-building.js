// @flow
import * as I from 'immutable'
import * as Types from './types/team-building'

const services: Array<Types.ServiceIdWithContact> = [
  'keybase',
  'contact',
  'twitter',
  'facebook',
  'github',
  'reddit',
  'hackernews',
]

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
})

export {followStateHelperWithId, makeSubState, services}
