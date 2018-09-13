// @flow
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
    ],
    endpoint: 'user/user_search',
  })
    .then(results => JSON.parse(results.body).list)
    .then(results => console.log('results are', results))
}

function* chatTeamBuildingSaga(): Saga.SagaGenerator<any, any> {
  // Navigation
  yield Saga.actionToAction(TeamBuildingGen.cancelTeamBuilding, closeTeamBuilding)
  yield Saga.actionToPromise(TeamBuildingGen.search, search)
}

export default chatTeamBuildingSaga
