import logger from '../logger'
import * as Constants from '../constants/team-building'
import * as SettingsConstants from '../constants/settings'
import * as RouterConstants from '../constants/router2'
import type * as TeamBuildingTypes from '../constants/types/team-building'
import * as TeamBuildingGen from './team-building-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Container from '../util/container'
import {validateEmailAddress} from '../util/email-address'
import {serviceIdFromString} from '../util/platforms'
import {RPCError} from '../util/errors'

const closeTeamBuilding = (_: Container.TypedState) => {
  const modals = RouterConstants.getModalStack()
  const routeNames = [...namespaceToRoute.values()]
  const routeName = modals[modals.length - 1]?.name

  return !routeNames.includes(routeName ?? '') ? false : RouteTreeGen.createNavigateUp()
}

export type NSAction = {payload: {namespace: TeamBuildingTypes.AllowedNamespace}}
type SearchOrRecAction = {payload: {namespace: TeamBuildingTypes.AllowedNamespace; includeContacts: boolean}}

const parseRawResultToUser = (
  result: RPCTypes.APIUserSearchResult,
  service: TeamBuildingTypes.ServiceIdWithContact
): TeamBuildingTypes.User | undefined => {
  const serviceMap = Object.keys(result.servicesSummary || {}).reduce<{[key: string]: string}>(
    (acc, service_name) => {
      acc[service_name] = result.servicesSummary[service_name]?.username ?? ''
      return acc
    },
    {}
  )

  // Add the keybase service to the service map since it isn't there by default
  if (result.keybase) {
    serviceMap['keybase'] = result.keybase.username
  }

  if (service === 'keybase' && result.keybase) {
    return {
      id: result.keybase.username,
      prettyName: result.keybase.fullName || result.keybase.username,
      serviceId: 'keybase' as const,
      serviceMap,
      username: result.keybase.username,
    }
  } else if (service === 'keybase' && result.contact) {
    const serviceId = result.contact.component.phoneNumber ? 'phone' : 'email'
    return {
      contact: true,
      id: result.contact.assertion,
      label: result.contact.displayLabel,
      prettyName: result.contact.displayName,
      serviceId,
      serviceMap: {...result.contact.serviceMap, keybase: result.contact.username},
      username: result.contact.component.email || result.contact.component.phoneNumber || '',
    }
  } else if (result.imptofu) {
    const serviceId = result.imptofu.assertionKey === 'phone' ? 'phone' : 'email'
    return {
      id: result.imptofu.assertion,
      label: result.imptofu.label,
      prettyName: result.imptofu.prettyName,
      serviceId,
      serviceMap: {...serviceMap, keybase: result.imptofu.keybaseUsername},
      username: result.imptofu.assertionValue,
    }
  } else if (result.service) {
    if (result.service.serviceName !== service) {
      // This shouldn't happen
      logger.error(
        `Search result's service_name is different than given service name. Expected: ${service} received ${result.service.serviceName}`
      )
      return
    }

    const kbPrettyName = result.keybase && (result.keybase.fullName || result.keybase.username)

    const prettyName = result.service.fullName || kbPrettyName || ''

    const pictureUrl = result.keybase?.pictureUrl || result.service?.pictureUrl

    let id = `${result.service.username}@${result.service.serviceName}`
    if (result.keybase) {
      // If it's also a keybase user, make a compound assertion.
      id += `+${result.keybase.username}`
    }

    return {
      id,
      pictureUrl,
      prettyName,
      serviceId: service,
      serviceMap,
      username: result.service.username,
    }
  }
  return
}

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
      const u = parseRawResultToUser(r, service)
      u && arr.push(u)
      return arr
    }, [])
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return []
    }
    logger.error(`Error in searching for ${query} on ${service}. ${error.message}`)
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
async function specialContactSearch(users: TeamBuildingTypes.User[], query: string, region?: string) {
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

const search = async (
  state: Container.TypedState,
  {payload: {namespace, includeContacts}}: SearchOrRecAction
) => {
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
    const userRegion = SettingsConstants.useContactsState.getState().userCountryCode
    users = await specialContactSearch(users, searchQuery, userRegion)
  }
  return TeamBuildingGen.createSearchResultsLoaded({
    namespace,
    query: searchQuery,
    service: selectedService,
    users,
  })
}

type HasServiceMap = {
  username: string
  serviceMap: {[key: string]: string}
}

const pluckServiceMap = (contact: HasServiceMap) =>
  Object.entries(contact.serviceMap || {})
    .concat([['keybase', contact.username]])
    .reduce<TeamBuildingTypes.ServiceMap>((acc, [service, username]) => {
      if (serviceIdFromString(service) === service) {
        // Service can also give us proof values like "https" or "dns" that
        // we don't want here.
        acc[service] = username
      }
      return acc
    }, {})

const contactToUser = (contact: RPCTypes.ProcessedContact): TeamBuildingTypes.User => ({
  contact: true,
  id: contact.assertion,
  label: contact.displayLabel,
  prettyName: contact.displayName,
  serviceId: contact.component.phoneNumber ? 'phone' : 'email',
  serviceMap: pluckServiceMap(contact),
  username: contact.component.email || contact.component.phoneNumber || '',
})

const interestingPersonToUser = (person: RPCTypes.InterestingPerson): TeamBuildingTypes.User => {
  const {username, fullname} = person
  return {
    id: username,
    prettyName: fullname,
    serviceId: 'keybase' as const,
    serviceMap: pluckServiceMap(person),
    username: username,
  }
}
const fetchUserRecs = async (_: unknown, {payload: {namespace, includeContacts}}: SearchOrRecAction) => {
  try {
    const [_suggestionRes, _contactRes] = await Promise.all([
      RPCTypes.userInterestingPeopleRpcPromise({maxUsers: 50, namespace}),
      includeContacts
        ? RPCTypes.contactsGetContactsForUserRecommendationsRpcPromise()
        : Promise.resolve([] as RPCTypes.ProcessedContact[]),
    ])
    const suggestionRes = _suggestionRes || []
    const contactRes = _contactRes || []
    const contacts = contactRes.map(contactToUser)
    let suggestions = suggestionRes.map(interestingPersonToUser)
    const expectingContacts = SettingsConstants.useContactsState.getState().importEnabled && includeContacts
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
    if (a?.payload?.namespace === namespace) {
      return fn(s, a, l)
    }
    return undefined
  }
}

const namespaceToRoute = new Map([
  ['chat2', 'chatNewChat'],
  ['crypto', 'cryptoTeamBuilder'],
  ['teams', 'teamsTeamBuilder'],
  ['people', 'peopleTeamBuilder'],
  ['wallets', 'walletTeamBuilder'],
])

const maybeCancelTeamBuilding =
  (namespace: TeamBuildingTypes.AllowedNamespace) =>
  (_: unknown, action: RouteTreeGen.OnNavChangedPayload) => {
    const {prev, next} = action.payload

    const wasTeamBuilding = namespaceToRoute.get(namespace) === RouterConstants.getVisibleScreen(prev)?.name
    if (wasTeamBuilding) {
      // team building or modal on top of that still
      const isTeamBuilding = namespaceToRoute.get(namespace) === RouterConstants.getVisibleScreen(next)?.name
      if (!isTeamBuilding) {
        return TeamBuildingGen.createCancelTeamBuilding({namespace})
      }
    }
    return false
  }

export const commonListenActions = (namespace: TeamBuildingTypes.AllowedNamespace) => {
  Container.listenAction(TeamBuildingGen.search, filterForNs(namespace, search))
  Container.listenAction(TeamBuildingGen.fetchUserRecs, filterForNs(namespace, fetchUserRecs))
  Container.listenAction(RouteTreeGen.onNavChanged, maybeCancelTeamBuilding(namespace))
  // Navigation, before creating
  Container.listenAction(
    [TeamBuildingGen.cancelTeamBuilding, TeamBuildingGen.finishedTeamBuilding],
    filterForNs(namespace, closeTeamBuilding)
  )
}
