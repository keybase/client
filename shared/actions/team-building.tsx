import logger from '../logger'
import * as Constants from '../constants/team-building'
import * as TeamBuildingTypes from '../constants/types/team-building'
import * as TeamBuildingGen from './team-building-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as Saga from '../util/saga'
import * as RPCTypes from '../constants/types/rpc-gen'
import {TypedState} from '../constants/reducer'

const closeTeamBuilding = () => RouteTreeGen.createClearModals()
export type NSAction = {payload: {namespace: TeamBuildingTypes.AllowedNamespace}}
type SearchOrRecAction = {payload: {namespace: TeamBuildingTypes.AllowedNamespace; includeContacts: boolean}}

const apiSearch = async (
  query: string,
  service: TeamBuildingTypes.ServiceIdWithContact,
  maxResults: number,
  includeServicesSummary: boolean,
  includeContacts: boolean
): Promise<Array<TeamBuildingTypes.User>> => {
  try {
    const results = await RPCTypes.userSearchUserSearchRpcPromise(
      {
        includeContacts: service === 'keybase' && includeContacts,
        includeServicesSummary,
        maxResults,
        query,
        service,
      },
      Constants.searchWaitingKey
    )
    return (results || []).reduce<Array<TeamBuildingTypes.User>>((arr, r) => {
      const u = Constants.parseRawResultToUser(r, service)
      u && arr.push(u)
      return arr
    }, [])
  } catch (err) {
    logger.error(`Error in searching for ${query} on ${service}. ${err.message}`)
    return []
  }
}

const search = async (state: TypedState, {payload: {namespace, includeContacts}}: SearchOrRecAction) => {
  const {teamBuildingSearchQuery, teamBuildingSelectedService, teamBuildingSearchLimit} = state[
    namespace
  ].teamBuilding
  // We can only ask the api for at most 100 results
  if (teamBuildingSearchLimit > 100) {
    logger.info('ignoring search request with a limit over 100')
    return false
  }

  const users = await apiSearch(
    teamBuildingSearchQuery,
    teamBuildingSelectedService,
    teamBuildingSearchLimit,
    true /* includeServicesSummary */,
    includeContacts
  )
  return TeamBuildingGen.createSearchResultsLoaded({
    namespace,
    query: teamBuildingSearchQuery,
    service: teamBuildingSelectedService,
    users,
  })
}

const fetchUserRecs = async (
  state: TypedState,
  {payload: {namespace, includeContacts}}: SearchOrRecAction
) => {
  try {
    const [_suggestionRes, _contactRes] = await Promise.all([
      RPCTypes.userInterestingPeopleRpcPromise({maxUsers: 50}),
      includeContacts
        ? RPCTypes.contactsGetContactsForUserRecommendationsRpcPromise()
        : Promise.resolve([] as RPCTypes.ProcessedContact[]),
    ])
    const suggestionRes = _suggestionRes || []
    const contactRes = _contactRes || []
    const contacts = contactRes.map(Constants.contactToUser)
    let suggestions = suggestionRes.map(Constants.interestingPersonToUser)
    const expectingContacts = state.settings.contacts.importEnabled && includeContacts
    if (expectingContacts) {
      suggestions = suggestions.slice(0, 10)
    }
    return TeamBuildingGen.createFetchedUserRecs({namespace, users: suggestions.concat(contacts)})
  } catch (_) {
    logger.error(`Error in fetching recs`)
    return TeamBuildingGen.createFetchedUserRecs({namespace, users: []})
  }
}

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

export default function* commonSagas(namespace: TeamBuildingTypes.AllowedNamespace) {
  yield* Saga.chainAction2(TeamBuildingGen.search, filterForNs(namespace, search))
  yield* Saga.chainAction2(TeamBuildingGen.fetchUserRecs, filterForNs(namespace, fetchUserRecs))
  // Navigation, before creating
  yield* Saga.chainAction2(
    [TeamBuildingGen.cancelTeamBuilding, TeamBuildingGen.finishedTeamBuilding],
    filterForNs(namespace, closeTeamBuilding)
  )
}
