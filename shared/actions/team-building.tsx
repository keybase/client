import logger from '../logger'
import * as Constants from '../constants/team-building'
import * as ChatConstants from '../constants/chat2'
import * as TeamBuildingTypes from '../constants/types/team-building'
import * as TeamBuildingGen from './team-building-gen'
import * as Chat2Gen from './chat2-gen'
import * as TeamsGen from './teams-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as Saga from '../util/saga'
import * as RPCTypes from '../constants/types/rpc-gen'
import {TypedState} from '../constants/reducer'

const closeTeamBuilding = () => RouteTreeGen.createClearModals()
type NSAction = {payload: {namespace: TeamBuildingTypes.AllowedNamespace}}

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

function* searchResultCounts(state: TypedState, {payload: {namespace}}: NSAction) {
  const teamBuildingState = state[namespace].teamBuilding
  const {teamBuildingSearchQuery, teamBuildingSelectedService} = teamBuildingState
  const teamBuildingSearchLimit = 11 // Hard coded since this happens for background tabs

  if (teamBuildingSearchQuery === '') {
    return
  }

  // filter out the service we are searching for and contact
  // Also filter out if we already have that result cached
  const servicesToSearch = Constants.services
    .filter(s => s !== teamBuildingSelectedService && s !== 'contact')
    .filter(s => !teamBuildingState.teamBuildingSearchResults.hasIn([teamBuildingSearchQuery, s]))

  const isStillInSameQuery = (state: TypedState): boolean =>
    teamBuildingState.teamBuildingSearchQuery === teamBuildingSearchQuery &&
    teamBuildingState.teamBuildingSelectedService === teamBuildingSelectedService

  // Defer so we aren't conflicting with the main search
  yield Saga.callUntyped(Saga.delay, 100)

  // Change this to control how many requests are in flight at a time
  const parallelRequestsCount = 2

  // Channel to interact with workers. Initial buffer size to handle all the messages we'll put
  // + 1 because we'll put the END message at the end when we close
  const serviceChannel = yield Saga.callUntyped(
    Saga.channel,
    Saga.buffers.expanding(servicesToSearch.length + 1)
  )
  servicesToSearch.forEach(service => serviceChannel.put(service))
  // After the workers pull all the services they can stop
  serviceChannel.close()

  for (let i = 0; i < parallelRequestsCount; i++) {
    yield Saga.spawn(function*() {
      // The loop will exit when we run out of services
      while (true) {
        const service = yield Saga.take(serviceChannel)
        // if we aren't in the same query, let's stop
        if (!isStillInSameQuery(yield* Saga.selectState())) {
          break
        }
        const action = yield apiSearch(teamBuildingSearchQuery, service, teamBuildingSearchLimit, true).then(
          users =>
            TeamBuildingGen.createSearchResultsLoaded({
              namespace,
              query: teamBuildingSearchQuery,
              service,
              users,
            })
        )
        yield Saga.put(action)
      }
    })
  }
}

const search = (state: TypedState, {payload: {namespace}}: NSAction) => {
  const {teamBuildingSearchQuery, teamBuildingSelectedService, teamBuildingSearchLimit} = state[
    namespace
  ].teamBuilding
  // We can only ask the api for at most 100 results
  if (teamBuildingSearchLimit > 100) {
    logger.info('ignoring search request with a limit over 100')
    return
  }

  // TODO add a way to search for contacts
  if (teamBuildingSearchQuery === '' || teamBuildingSelectedService === 'contact') {
    return
  }

  return apiSearch(teamBuildingSearchQuery, teamBuildingSelectedService, teamBuildingSearchLimit, true).then(
    users =>
      TeamBuildingGen.createSearchResultsLoaded({
        namespace,
        query: teamBuildingSearchQuery,
        service: teamBuildingSelectedService,
        users,
      })
  )
}

const fetchUserRecs = (state: TypedState, {payload: {namespace}}: NSAction) =>
  RPCTypes.userInterestingPeopleRpcPromise({maxUsers: 50})
    .then((suggestions: Array<RPCTypes.InterestingPerson> | null) =>
      (suggestions || []).map(
        ({username, fullname}): TeamBuildingTypes.User => ({
          id: username,
          prettyName: fullname,
          serviceMap: {keybase: username},
        })
      )
    )
    .catch(e => {
      logger.error(`Error in fetching recs`)
      return []
    })
    .then(users => TeamBuildingGen.createFetchedUserRecs({namespace, users}))

const createConversation = (state: TypedState, {payload: {namespace}}: NSAction) => [
  Chat2Gen.createSelectConversation({
    conversationIDKey: ChatConstants.pendingWaitingConversationIDKey,
    reason: 'justCreated',
  }),
  Chat2Gen.createCreateConversation({
    participants: state[namespace].teamBuilding.teamBuildingFinishedTeam.toArray().map(u => u.id),
  }),
]

function addThemToTeam(
  state: TypedState,
  {payload: {teamname}}: TeamBuildingGen.FinishedTeamBuildingPayload,
  logger: Saga.SagaLogger
) {
  if (!teamname) {
    logger.error("Trying to add them to a team, but I don't know what the teamname is.")
    return
  }

  const role = state.teams.teamBuilding.teamBuildingFinishedSelectedRole
  const sendChatNotification = state.teams.teamBuilding.teamBuildingFinishedSendNotification

  return state.teams.teamBuilding.teamBuildingFinishedTeam.toArray().map(user =>
    TeamsGen.createAddToTeam({
      role,
      sendChatNotification,
      teamname,
      username: user.id,
    })
  )
}

function filterForNs<S, A, L, R>(
  namespace: TeamBuildingTypes.AllowedNamespace,
  fn: (s: S, a: A & NSAction, l: L) => R
) {
  return (s, a, l) => {
    if (a && a.payload && a.payload.namespace === namespace) {
      return fn(s, a, l)
    }
  }
}

function filterGenForNs<S, A, L, R>(
  namespace: TeamBuildingTypes.AllowedNamespace,
  fn: (s: S, a: A & NSAction, l: L) => Iterable<any>
) {
  return function*(s, a, l) {
    if (a && a.payload && a.payload.namespace === namespace) {
      yield* fn(s, a, l)
    }
  }
}

function* commonSagas(namespace: TeamBuildingTypes.AllowedNamespace): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction<TeamBuildingGen.SearchPayload>(
    TeamBuildingGen.search,
    filterForNs(namespace, search)
  )
  yield* Saga.chainAction<TeamBuildingGen.FetchUserRecsPayload>(
    TeamBuildingGen.fetchUserRecs,
    filterForNs(namespace, fetchUserRecs)
  )
  yield* Saga.chainGenerator<TeamBuildingGen.SearchPayload>(
    TeamBuildingGen.search,
    filterGenForNs(namespace, searchResultCounts)
  )
  // Navigation, before creating
  yield* Saga.chainAction<
    TeamBuildingGen.CancelTeamBuildingPayload | TeamBuildingGen.FinishedTeamBuildingPayload
  >(
    [TeamBuildingGen.cancelTeamBuilding, TeamBuildingGen.finishedTeamBuilding],
    filterForNs(namespace, closeTeamBuilding)
  )
}

function* chatTeamBuildingSaga(): Saga.SagaGenerator<any, any> {
  yield* commonSagas('chat2')
  yield* Saga.chainAction<TeamBuildingGen.FinishedTeamBuildingPayload>(
    TeamBuildingGen.finishedTeamBuilding,
    filterForNs('chat2', createConversation)
  )
}

function* teamsTeamBuildingSaga(): Saga.SagaGenerator<any, any> {
  yield* commonSagas('teams')

  yield* Saga.chainAction<TeamBuildingGen.FinishedTeamBuildingPayload>(
    TeamBuildingGen.finishedTeamBuilding,
    filterForNs('teams', addThemToTeam)
  )
}

export {chatTeamBuildingSaga, teamsTeamBuildingSaga}
