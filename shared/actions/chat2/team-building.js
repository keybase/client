// @flow
import logger from '../../logger'
import * as TeamBuildingTypes from '../../constants/types/team-building'
import * as TeamBuildingGen from '../team-building-gen'
import * as Chat2Gen from '../chat2-gen'
import * as RouteTreeGen from '../route-tree-gen'
import * as Saga from '../../util/saga'
import * as RPCTypes from '../../constants/types/rpc-gen'
import {trim} from 'lodash-es'
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

const search = (_, {payload: {query, service, limit = 10}}: TeamBuildingGen.SearchPayload) => {
  const trimmed_query = trim(query)
  if (trimmed_query === '') {
    return
  }

  if (service === 'contact') {
    // TODO add a way to search for contacts
    return Promise.reject(new Error('Contact search is not implemented'))
  }

  return RPCTypes.apiserverGetWithSessionRpcPromise({
    args: [
      {key: 'q', value: trimmed_query},
      {key: 'num_wanted', value: String(limit)},
      {key: 'service', value: service === 'keybase' ? '' : service},
      {key: 'include_services_summary', value: '1'},
    ],
    endpoint: 'user/user_search',
  }).then(results => {
    const users = JSON.parse(results.body)
      .list.map(r => parseRawResultToUser(r, service))
      .filter(u => !!u)
    return TeamBuildingGen.createSearchResultsLoaded({users, query, service})
  })
}

const parseRawResultToUser = (
  result: RawSearchResult,
  service: TeamBuildingTypes.ServiceIdWithContact
): ?TeamBuildingTypes.User => {
  const serviceMap = Object.keys(result.services_summary).reduce((acc, service_name) => {
    acc[service_name] = result.services_summary[service_name].username
    return acc
  }, {})

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
    return {
      serviceMap,
      id: `${result.service.username}@${result.service.service_name}`,
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
  yield Saga.actionToAction(TeamBuildingGen.finishedTeamBuilding, createConversation)

  // Navigation
  yield Saga.actionToAction(
    [TeamBuildingGen.cancelTeamBuilding, TeamBuildingGen.finishedTeamBuilding],
    closeTeamBuilding
  )
}

export default chatTeamBuildingSaga
