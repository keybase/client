import logger from '../logger'
import * as SettingsConstants from '../constants/settings'
import * as RouterConstants from '../constants/router2'
import type * as TeamBuildingTypes from '../constants/types/team-building'
import * as TeamBuildingGen from './team-building-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Container from '../util/container'
import {serviceIdFromString} from '../util/platforms'

export type NSAction = {payload: {namespace: TeamBuildingTypes.AllowedNamespace}}
type SearchOrRecAction = {payload: {namespace: TeamBuildingTypes.AllowedNamespace; includeContacts: boolean}}

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
  Container.listenAction(TeamBuildingGen.fetchUserRecs, filterForNs(namespace, fetchUserRecs))
  Container.listenAction(RouteTreeGen.onNavChanged, maybeCancelTeamBuilding(namespace))
}
