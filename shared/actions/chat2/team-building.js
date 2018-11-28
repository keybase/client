// @flow
import logger from '../../logger'
import * as Constants from '../../constants/team-building'
import * as TeamBuildingTypes from '../../constants/types/team-building'
import * as TeamBuildingGen from '../team-building-gen'
import * as Chat2Gen from '../chat2-gen'
import * as RouteTreeGen from '../route-tree-gen'
import * as Saga from '../../util/saga'
import * as RPCTypes from '../../constants/types/rpc-gen'
import {type TypedState} from '../../constants/reducer'

const closeTeamBuilding = () => Saga.put(RouteTreeGen.createNavigateUp())

const apiSearch = (
  query: string,
  service: TeamBuildingTypes.ServiceIdWithContact,
  limit: number,
  includeServicesSummary: boolean
): Promise<Array<TeamBuildingTypes.User>> =>
  RPCTypes.apiserverGetWithSessionRpcPromise({
    args: [
      {key: 'q', value: query},
      {key: 'num_wanted', value: String(limit)},
      {key: 'service', value: service === 'keybase' ? '' : service},
      {key: 'include_services_summary', value: includeServicesSummary ? '1' : '0'},
    ],
    endpoint: 'user/user_search',
  })
    .then(results =>
      JSON.parse(results.body)
        .list.map(r => Constants.parseRawResultToUser(r, service))
        .filter(u => !!u)
    )
    .catch(err => {
      logger.error(`Error in searching for ${query} on ${service}. ${err.message}`)
      return []
    })

const searchResultCounts = (state: TypedState) => {
  const {teamBuildingSearchQuery, teamBuildingSelectedService, teamBuildingSearchLimit} = state.chat2

  if (teamBuildingSearchQuery === '') {
    return
  }

  // filter out the service we are searching for and contact
  const servicesToSearch = Constants.services.filter(
    s => s !== teamBuildingSelectedService && s !== 'contact'
  )

  const isStillInSameQuery = (state: TypedState): boolean =>
    state.chat2.teamBuildingSearchQuery === teamBuildingSearchQuery &&
    state.chat2.teamBuildingSelectedService === teamBuildingSelectedService

  return Saga.call(function*() {
    // Defer so we aren't conflicting with the main search
    yield Saga.call(Saga.delay, 100)

    // Change this to control how many requests are in flight at a time
    const parallelRequestsCount = 2

    // Channel to interact with workers. Initial buffer size to handle all the messages we'll put
    // + 1 because we'll put the END message at the end when we close
    const serviceChannel = yield Saga.call(Saga.channel, Saga.buffers.expanding(servicesToSearch.length + 1))
    servicesToSearch.forEach(service => serviceChannel.put(service))
    // After the workers pull all the services they can stop
    serviceChannel.close()

    for (let i = 0; i < parallelRequestsCount; i++) {
      yield Saga.spawn(function*() {
        // The loop will exit when we run out of services
        while (true) {
          const service = yield Saga.take(serviceChannel)
          // if we aren't in the same query, let's stop
          if (!isStillInSameQuery(yield Saga.select())) {
            break
          }
          const action = yield apiSearch(
            teamBuildingSearchQuery,
            service,
            teamBuildingSearchLimit,
            true
          ).then(users =>
            TeamBuildingGen.createSearchResultsLoaded({
              users,
              query: teamBuildingSearchQuery,
              service,
            })
          )
          yield Saga.put(action)
        }
      })
    }
  })
}

const search = (state: TypedState) => {
  const {teamBuildingSearchQuery, teamBuildingSelectedService, teamBuildingSearchLimit} = state.chat2

  // TODO add a way to search for contacts
  if (teamBuildingSearchQuery === '' || teamBuildingSelectedService === 'contact') {
    return
  }

  return apiSearch(teamBuildingSearchQuery, teamBuildingSelectedService, teamBuildingSearchLimit, true).then(
    users =>
      TeamBuildingGen.createSearchResultsLoaded({
        users,
        query: teamBuildingSearchQuery,
        service: teamBuildingSelectedService,
      })
  )
}

const fetchUserRecs = (state: TypedState) =>
  RPCTypes.userInterestingPeopleRpcPromise({maxUsers: 50})
    .then((suggestions: ?Array<RPCTypes.InterestingPerson>) =>
      (suggestions || []).map(
        ({username}): TeamBuildingTypes.User => ({
          id: username,
          prettyName: `${username} on Keybase`,
          serviceMap: {},
        })
      )
    )
    .catch(e => {
      logger.error(`Error in fetching recs`)
      return []
    })
    .then(users => TeamBuildingGen.createFetchedUserRecs({users}))

const createConversation = (state: TypedState) =>
  Saga.put(
    Chat2Gen.createCreateConversation({
      participants: state.chat2.teamBuildingFinishedTeam.toArray().map(u => u.id),
    })
  )

function* chatTeamBuildingSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.actionToPromise(TeamBuildingGen.search, search)
  yield Saga.actionToPromise(TeamBuildingGen.fetchUserRecs, fetchUserRecs)
  yield Saga.actionToAction(TeamBuildingGen.search, searchResultCounts)
  yield Saga.actionToAction(TeamBuildingGen.finishedTeamBuilding, createConversation)

  // Navigation
  yield Saga.actionToAction(
    [TeamBuildingGen.cancelTeamBuilding, TeamBuildingGen.finishedTeamBuilding],
    closeTeamBuilding
  )
}

export default chatTeamBuildingSaga
