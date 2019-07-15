import logger from '../logger'
import * as Constants from '../constants/team-building'
import * as TeamBuildingTypes from '../constants/types/team-building'
import * as TeamBuildingGen from './team-building-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as Saga from '../util/saga'
import * as RPCTypes from '../constants/types/rpc-gen'
import {TypedState} from '../constants/reducer'
import flags from '../util/feature-flags'
import {validateNumber} from '../util/phone-numbers'

const closeTeamBuilding = () => RouteTreeGen.createClearModals()
export type NSAction = {payload: {namespace: TeamBuildingTypes.AllowedNamespace}}

const apiSearch = (
  query: string,
  service: TeamBuildingTypes.ServiceIdWithContact,
  maxResults: number,
  includeServicesSummary: boolean,
  impTofuQuery: RPCTypes.ImpTofuQuery | null
): Promise<Array<TeamBuildingTypes.User>> => {
  console.log('zzz api search', query, service, impTofuQuery)
  return RPCTypes.userSearchUserSearchRpcPromise({
    impTofuQuery,
    includeContacts: flags.sbsContacts && service === 'keybase',
    includeServicesSummary,
    maxResults,
    query,
    service,
  })
    .then(results =>
      (results || []).reduce<Array<TeamBuildingTypes.User>>((arr, r) => {
        const u = Constants.parseRawResultToUser(r, service)
        u && arr.push(u)
        return arr
      }, [])
    )
    .catch(err => {
      logger.error(`Error in searching for ${query} on ${service}. ${err.message}`)
      return []
    })
}

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

  const isStillInSameQuery = (state: TypedState): boolean => {
    const teamBuildingState = state[namespace].teamBuilding

    return (
      teamBuildingState.teamBuildingSearchQuery === teamBuildingSearchQuery &&
      teamBuildingState.teamBuildingSelectedService === teamBuildingSelectedService
    )
  }

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
        const action = yield apiSearch(
          teamBuildingSearchQuery,
          service,
          teamBuildingSearchLimit,
          true,
          null
        ).then(users =>
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

const makeImpTofuQuery = (query: string, region: string | null): RPCTypes.ImpTofuQuery | null => {
  const phoneNumber = validateNumber(query, region)
  if (phoneNumber.valid) {
    return {
      phone: phoneNumber.e164,
      t: RPCTypes.ImpTofuSearchType.phone,
    }
  } else {
    // Consider the query a valid email if it contains at sign and a period
    // after the at sign.
    const atIndex = query.indexOf('@')
    const periodIndex = query.lastIndexOf('.')
    if (atIndex !== -1 && periodIndex > atIndex && periodIndex !== query.length - 1) {
      return {
        email: query,
        t: RPCTypes.ImpTofuSearchType.email,
      }
    }
  }
  return null
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

  const query = teamBuildingSearchQuery
  let impTofuQuery: RPCTypes.ImpTofuQuery | null = null
  if (flags.sbsContacts && teamBuildingSelectedService === 'keybase') {
    const userRegion = state.settings.contacts.userCountryCode
    impTofuQuery = makeImpTofuQuery(query, userRegion)
  }

  return apiSearch(query, teamBuildingSelectedService, teamBuildingSearchLimit, true, impTofuQuery).then(
    users =>
      TeamBuildingGen.createSearchResultsLoaded({
        namespace,
        query,
        service: teamBuildingSelectedService,
        users,
      })
  )
}

const fetchUserRecs = (state: TypedState, {payload: {namespace}}: NSAction) =>
  Promise.all([
    RPCTypes.userInterestingPeopleRpcPromise({maxUsers: 50}),
    flags.sbsContacts
      ? RPCTypes.contactsLookupSavedContactsListRpcPromise()
      : Promise.resolve([] as RPCTypes.ProcessedContact[]),
  ])
    .then(([_suggestionRes, _contactRes]) => {
      const suggestionRes = _suggestionRes || []
      const contactRes = _contactRes || []
      const contactUsernames = new Set(contactRes.map(x => x.username).filter(Boolean))
      const contacts = contactRes.map(
        (x): TeamBuildingTypes.User => ({
          id: x.assertion,
          label: x.displayLabel,
          prettyName: x.displayName,
          serviceMap: {keybase: x.username},
        })
      )
      let suggestions = suggestionRes
        .filter(({username}) => !contactUsernames.has(username))
        .map(
          ({username, fullname}): TeamBuildingTypes.User => ({
            id: username,
            prettyName: fullname,
            serviceMap: {keybase: username},
          })
        )
      const expectingContacts = flags.sbsContacts && state.settings.contacts.importEnabled
      if (expectingContacts) {
        suggestions = suggestions.slice(0, 5)
      }
      return suggestions.concat(contacts)
    })
    .catch(() => {
      logger.error(`Error in fetching recs`)
      return []
    })
    .then(users => TeamBuildingGen.createFetchedUserRecs({namespace, users}))

export function filterForNs<S, A, L, R>(
  namespace: TeamBuildingTypes.AllowedNamespace,
  fn: (s: S, a: A & NSAction, l: L) => R
) {
  return (s, a, l) => {
    if (a && a.payload && a.payload.namespace === namespace) {
      return fn(s, a, l)
    }
      return undefined
  }
}

function filterGenForNs<S, A, L>(
  namespace: TeamBuildingTypes.AllowedNamespace,
  fn: (s: S, a: A & NSAction, l: L) => Iterable<any>
) {
  return function*(s, a, l) {
    if (a && a.payload && a.payload.namespace === namespace) {
      yield* fn(s, a, l)
    }
  }
}

export default function* commonSagas(
  namespace: TeamBuildingTypes.AllowedNamespace
): Saga.SagaGenerator<any, any> {
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
