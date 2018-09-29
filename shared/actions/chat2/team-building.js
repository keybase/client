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

type RawSearchResult = {
  score: number,
  keybase: ?{
    username: string,
    uid: string,
    picture_url: string,
    full_name: string,
    is_followee: boolean,
  },
  service: ?{
    service_name: TeamBuildingTypes.ServiceIdWithContact,
    username: string,
    picture_url: string,
    bio: string,
    location: string,
    full_name: string,
  },
  services_summary: {
    [key: TeamBuildingTypes.ServiceIdWithContact]: {
      service_name: TeamBuildingTypes.ServiceIdWithContact,
      username: string,
    },
  },
}

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
  }).then(results =>
    JSON.parse(results.body)
      .list.map(r => parseRawResultToUser(r, service))
      .filter(u => !!u)
  )

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

    // Channel to interact with workers. Fixed buffer size to handle all the messages we'll put
    // + 1 because we'll put the END message at the end when we close
    const serviceChannel = yield Saga.call(Saga.channel, Saga.buffers.fixed(servicesToSearch.length + 1))
    servicesToSearch.forEach(service => serviceChannel.put(service))
    // After the workers pull all the services they can stop
    serviceChannel.close()

    for (let i = 0; i < parallelRequestsCount; i++) {
      yield Saga.fork(function*() {
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

const parseRawResultToUser = (
  result: RawSearchResult,
  service: TeamBuildingTypes.ServiceIdWithContact
): ?TeamBuildingTypes.User => {
  const serviceMap = result.services_summary
    ? Object.keys(result.services_summary).reduce((acc, service_name) => {
        acc[service_name] = result.services_summary[service_name].username
        return acc
      }, {})
    : {}

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

const createConversation = (state: TypedState) =>
  Saga.put(
    Chat2Gen.createCreateConversation({
      participants: state.chat2.teamBuildingFinishedTeam.toArray().map(u => u.id),
    })
  )

function* chatTeamBuildingSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.actionToPromise(TeamBuildingGen.search, search)
  yield Saga.actionToAction(TeamBuildingGen.search, searchResultCounts)
  yield Saga.actionToAction(TeamBuildingGen.finishedTeamBuilding, createConversation)

  // Navigation
  yield Saga.actionToAction(
    [TeamBuildingGen.cancelTeamBuilding, TeamBuildingGen.finishedTeamBuilding],
    closeTeamBuilding
  )
}

export default chatTeamBuildingSaga
