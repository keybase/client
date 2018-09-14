// @flow
import * as I from 'immutable'
import logger from '../../logger'
import * as TeamBuildingTypes from '../../constants/types/team-building'
import * as TeamBuildingGen from '../team-building-gen'
import * as RouteTreeGen from '../route-tree-gen'
import * as Saga from '../../util/saga'
import * as RPCTypes from '../../constants/types/rpc-gen'
import {trim} from 'lodash-es'

type RawSearchResult = {
  score: number,
  keybase: ?{
    username: string,
    uid: string,
    picture_url: ?string,
    full_name: ?string,
    is_followee: boolean,
  },
  service: ?{
    service_name: TeamBuildingTypes.ServiceIdWithContact,
    username: string,
    picture_url: ?string,
    bio: ?string,
    location: ?string,
    full_name: ?string,
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
  if (service === 'contact') {
    // TODO add a way to search for contacts
    return Promise.reject(new Error('Contact search is not implemented'))
  }

  return RPCTypes.apiserverGetWithSessionRpcPromise({
    args: [
      {key: 'q', value: trim(query)},
      {key: 'num_wanted', value: String(limit)},
      {key: 'service', value: service === 'keybase' ? '' : service},
      {key: 'include_services_summary', value: 1},
    ],
    endpoint: 'user/user_search',
  })
    .then(results => JSON.parse(results.body).list)
    .then(results => results.map(r => parserRawResultToUser(r, service)))
    .then(users => TeamBuildingGen.createSearchResultsLoaded({users, query, service}))
}

const parserRawResultToUser = (
  result: RawSearchResult,
  service: ServiceIdWithContact
): TeamBuildingTypes.User => {
  const serviceMap = Object.keys(result.services_summary).reduce((acc, service_name) => {
    acc[service_name] = result.services_summary[service_name].username
    return acc
  }, {})

  if (service === 'keybase') {
    return {
      serviceMap: I.Map(serviceMap),
      id: result.keybase.username,
      keybaseUserID: result.keybase.username,
      prettyName: result.keybase.full_name || result.keybase.username,
    }
  } else {
    if (result.service.service_name !== service) {
      // This shouldn't happen
      logger.error(
        `Search result's service_name is different than given service name. Expected: ${service} received ${
          result.service.service_name
        }`
      )
    }

    const prettyName =
      result.service.full_name || result.keybase
        ? result.keybase.full_name || result.keybase.username
        : `${result.service.username} on ${result.service.service_name}`
    return {
      serviceMap,
      id: `${result.service}@${result.service.service_name}`,
      keybaseUserID: result.keybase ? result.keybase.username : null,
      prettyName,
    }
  }
}

function* chatTeamBuildingSaga(): Saga.SagaGenerator<any, any> {
  // Navigation
  yield Saga.actionToAction(TeamBuildingGen.cancelTeamBuilding, closeTeamBuilding)
  yield Saga.actionToPromise(TeamBuildingGen.search, search)
}

export default chatTeamBuildingSaga
