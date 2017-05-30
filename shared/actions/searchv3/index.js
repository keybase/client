// @flow
import * as Constants from '../../constants/searchv3'
import * as Creators from './creators'
import * as EntityAction from '../entities'
import {apiserverGetWithSessionRpcPromise} from '../../constants/types/flow-types'
import {trim, keyBy} from 'lodash'
import {call, put, select} from 'redux-saga/effects'
import * as Selectors from '../../constants/selectors'
import * as Saga from '../../util/saga'
import {SearchError} from '../../util/errors'

import type {SagaGenerator} from '../../constants/types/saga'
import type {PlatformsExpandedType} from '../../constants/types/more'

type RawResult = {
  score: number,
  keybase: ?{
    username: string,
    uid: string,
    picture_url: ?string,
    full_name: ?string,
    is_followee: boolean,
  },
  service: ?{
    service_name: PlatformsExpandedType,
    username: string,
    picture_url: ?string,
    bio: ?string,
    location: ?string,
    full_name: ?string,
  },
}

function serviceNameToSearchPlatform(serviceName: string): Constants.SearchPlatform {
  return {
    keybase: 'Keybase',
    twitter: 'Twitter',
    github: 'Github',
    reddit: 'Reddit',
    hackernews: 'Hackernews',
    pgp: 'Pgp',
    facebook: 'Facebook',
  }[serviceName]
}

function serviceNameToService(serviceName: string): Constants.Service {
  return {
    keybase: 'Keybase',
    twitter: 'Twitter',
    github: 'GitHub',
    reddit: 'Reddit',
    hackernews: 'Hacker News',
    facebook: 'Facebook',
  }[serviceName]
}

function _rawResultToId(serviceName: string, serviceUsername: string): Constants.SearchResultId {
  return `${serviceName}-${serviceUsername}`
}

function _toSearchQuery(serviceName: string, searchTerm: string): Constants.SearchQuery {
  return `${serviceName}-${searchTerm}`
}

function _parseKeybaseRawResult(result: RawResult): Constants.SearchResult {
  if (result.keybase && result.service) {
    const {keybase, service} = result
    return {
      id: _rawResultToId('Keybase', keybase.username),
      leftIcon: null,
      leftUsername: keybase.username,
      leftService: 'Keybase',

      rightFullname: keybase.full_name,
      rightIcon: Constants.platformToIcon(serviceNameToSearchPlatform(service.service_name)),
      rightService: serviceNameToService(service.service_name),
      rightUsername: service.username,
    }
  }

  if (result.keybase) {
    const {keybase} = result
    return {
      id: _rawResultToId('Keybase', keybase.username),
      leftIcon: null,
      leftUsername: keybase.username,
      leftService: 'Keybase',

      rightFullname: keybase.full_name,
      rightIcon: null,
      rightService: null,
      rightUsername: null,
    }
  }

  throw new SearchError('Invalid raw result for keybase. Missing result.keybase', result)
}

function _parseThirdPartyRawResult(result: RawResult): Constants.SearchResult {
  if (result.service && result.keybase) {
    const {service, keybase} = result
    return {
      id: _rawResultToId(service.service_name, service.username),
      leftIcon: Constants.platformToLogo24(serviceNameToSearchPlatform(service.service_name)),
      leftUsername: service.username,
      leftService: serviceNameToService(service.service_name),

      rightFullname: keybase.full_name,
      rightIcon: null,
      rightService: 'Keybase',
      rightUsername: keybase.username,
    }
  }

  if (result.service) {
    const service = result.service
    return {
      id: _rawResultToId(service.service_name, service.username),
      leftIcon: Constants.platformToLogo24(serviceNameToSearchPlatform(service.service_name)),
      leftUsername: service.username,
      leftService: serviceNameToService(service.service_name),

      rightFullname: service.full_name,
      rightIcon: null,
      rightService: null,
      rightUsername: null,
    }
  }

  throw new SearchError('Invalid raw result for service search. Missing result.service', result)
}

function _parseRawResultToRow(result: RawResult, service: Constants.SearchPlatform) {
  if (service === '' || service === 'Keybase') {
    return _parseKeybaseRawResult(result, true)
  } else {
    return _parseThirdPartyRawResult(result, !!result.keybase)
  }
}

function _apiSearch(searchTerm: string, service: string = '', limit: number = 20) {
  return apiserverGetWithSessionRpcPromise({
    param: {
      args: [
        {key: 'q', value: trim(searchTerm)},
        {key: 'num_wanted', value: String(limit)},
        {key: 'service', value: service},
      ],
      endpoint: 'user/user_search',
    },
  }).then(results => JSON.parse(results.body))
}

function* search<T>({payload: {term, service, actionTypeToFire}}: Constants.Search<T>) {
  const searchQuery = _toSearchQuery(service, term)
  const cachedResults = yield select(Selectors.cachedSearchResults, searchQuery)
  if (cachedResults) {
    yield put(Creators.finishedSearch(actionTypeToFire, cachedResults, term, service))
    return
  }

  try {
    const searchResults = yield call(_apiSearch, term, service)
    const rows = searchResults.list.map((result: RawResult) => {
      return _parseRawResultToRow(result, service || 'Keybase')
    })
    const ids = rows.map(r => r.id)
    yield put(EntityAction.mergeEntity(['searchResults'], keyBy(rows, 'id')))
    yield put(EntityAction.mergeEntity(['searchQueryToResult'], {[searchQuery]: ids}))
    yield put(Creators.finishedSearch(actionTypeToFire, ids, term, service))
  } catch (error) {
    console.warn('error in searching', error)
  }
}

function* searchV3Saga(): SagaGenerator<any, any> {
  yield Saga.safeTakeLatest('searchv3:search', search)
}

export default searchV3Saga
