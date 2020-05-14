import logger from '../logger'
import * as Constants from '../constants/team-building'
import * as RouterConstants from '../constants/router2'
import * as TeamBuildingTypes from '../constants/types/team-building'
import * as TeamBuildingGen from './team-building-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as Saga from '../util/saga'
import * as RPCTypes from '../constants/types/rpc-gen'
import {TypedState} from '../constants/reducer'
import {validateEmailAddress} from '../util/email-address'
import flags from '../util/feature-flags'

const closeTeamBuilding = (_: TypedState, {payload: {namespace}}: NSAction) => {
  if (namespace === 'teams' && flags.teamsRedesign) {
    // add members wizard handles navigation
    return false
  }
  const modals = RouterConstants.getModalStack()
  const routeNames = [...namespaceToRoute.values()]
  const routeName = modals[modals.length - 1]?.routeName

  if (routeNames.indexOf(routeName) !== -1) {
    return RouteTreeGen.createNavigateUp()
  }
  return false
}

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

const apiSearchOne = async (
  query: string,
  service: TeamBuildingTypes.ServiceIdWithContact
): Promise<TeamBuildingTypes.User | undefined> =>
  (
    await apiSearch(
      query,
      service,
      1 /* maxResults */,
      true /* serviceSummaries */,
      false /* includeContacts */
    )
  )[0]

// If the query is a well-formatted phone number or email, do additional search
// and if the result is not already in the list, insert at the beginning.
async function specialContactSearch(users: TeamBuildingTypes.User[], query: string, region: string | null) {
  const {validateNumber} = require('../util/phone-numbers')
  let result: TeamBuildingTypes.User | undefined
  const phoneNumber = validateNumber(query, region)
  if (phoneNumber.valid) {
    result = await apiSearchOne(phoneNumber.e164, 'phone')
  } else if (validateEmailAddress(query)) {
    result = await apiSearchOne(query, 'email')
  }
  if (result && !users.find(x => result && x.id === result.id)) {
    // Overwrite `prettyName` to make the special result stand out.
    result.prettyName = query
    return [result, ...users]
  }
  return users
}

const search = async (state: TypedState, {payload: {namespace, includeContacts}}: SearchOrRecAction) => {
  const {searchQuery, selectedService, searchLimit} = state[namespace].teamBuilding
  // We can only ask the api for at most 100 results
  if (searchLimit > 100) {
    logger.info('ignoring search request with a limit over 100')
    return false
  }

  // Do the main search for selected service and query.
  let users = await apiSearch(
    searchQuery,
    selectedService,
    searchLimit,
    true /* includeServicesSummary */,
    includeContacts
  )
  if (selectedService === 'keybase') {
    // If we are on Keybase tab, do additional search if query is phone/email.
    const userRegion = state.settings.contacts.userCountryCode
    users = await specialContactSearch(users, searchQuery, userRegion ?? null)
  }
  return TeamBuildingGen.createSearchResultsLoaded({
    namespace,
    query: searchQuery,
    service: selectedService,
    users,
  })
}

const fetchUserRecs = async (
  state: TypedState,
  {payload: {namespace, includeContacts}}: SearchOrRecAction
) => {
  try {
    const [_suggestionRes, _contactRes] = await Promise.all([
      RPCTypes.userInterestingPeopleRpcPromise({maxUsers: 50, namespace}),
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
  } catch (err) {
    logger.error(`Error in fetching recs: ${err}`)
    return TeamBuildingGen.createFetchedUserRecs({namespace, users: []})
  }
}

export function filterForNs<S, A, L, R>(
  namespace: TeamBuildingTypes.AllowedNamespace,
  fn: (s: S, a: A & NSAction, l: L) => R
) {
  return (s: S, a: A & NSAction, l: L) => {
    if (a && a.payload && a.payload.namespace === namespace) {
      return fn(s, a, l)
    }
    return undefined
  }
}

const makeCustomResetStore = () =>
  TeamBuildingTypes.allowedNamespace.map(namespace => TeamBuildingGen.createTbResetStore({namespace}))

const namespaceToRoute = new Map([
  ['chat2', 'chatNewChat'],
  ['crypto', 'cryptoTeamBuilder'],
  ['teams', 'teamsTeamBuilder'],
  ['people', 'peopleTeamBuilder'],
  ['wallets', 'walletTeamBuilder'],
])

const maybeCancelTeamBuilding = (namespace: TeamBuildingTypes.AllowedNamespace) => (
  action: RouteTreeGen.OnNavChangedPayload
) => {
  const {prev, next} = action.payload

  const wasTeamBuilding = namespaceToRoute.get(namespace) === prev[prev.length - 1]?.routeName
  if (wasTeamBuilding) {
    // team building or modal on top of that still
    const isTeamBuilding = next[prev.length - 1] === prev[prev.length - 1]
    if (!isTeamBuilding) {
      return TeamBuildingGen.createCancelTeamBuilding({namespace})
    }
  }
  return false
}

export default function* commonSagas(namespace: TeamBuildingTypes.AllowedNamespace) {
  yield* Saga.chainAction2(TeamBuildingGen.resetStore, makeCustomResetStore)
  yield* Saga.chainAction2(TeamBuildingGen.search, filterForNs(namespace, search))
  yield* Saga.chainAction2(TeamBuildingGen.fetchUserRecs, filterForNs(namespace, fetchUserRecs))
  yield* Saga.chainAction(RouteTreeGen.onNavChanged, maybeCancelTeamBuilding(namespace))
  // Navigation, before creating
  yield* Saga.chainAction2(
    [TeamBuildingGen.cancelTeamBuilding, TeamBuildingGen.finishedTeamBuilding],
    filterForNs(namespace, closeTeamBuilding)
  )
}
