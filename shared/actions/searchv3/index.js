// @flow
import * as Constants from '../../constants/searchv3'
import * as Creators from './creators'
import * as EntityAction from '../entities'
import {
  apiserverGetWithSessionRpcPromise,
  userInterestingPeopleRpcPromise,
} from '../../constants/types/flow-types'
import trim from 'lodash/trim'
import keyBy from 'lodash/keyBy'
import {call, put, select} from 'redux-saga/effects'
import * as Selectors from '../../constants/selectors'
import * as Saga from '../../util/saga'
import {serviceIdToIcon, serviceIdToLogo24} from '../../util/platforms'
import {onIdlePromise} from '../../util/idle-callback'
import {SearchError} from '../../util/errors'

import type {ServiceId} from '../../util/platforms'
import type {SagaGenerator} from '../../constants/types/saga'
import type {InterestingPerson} from '../../constants/types/flow-types'

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
    service_name: ServiceId,
    username: string,
    picture_url: ?string,
    bio: ?string,
    location: ?string,
    full_name: ?string,
  },
}

function _serviceToApiServiceName(service: Constants.Service): string {
  return (
    {
      Facebook: 'facebook',
      GitHub: 'github',
      'Hacker News': 'hackernews',
      Keybase: '',
      Reddit: 'reddit',
      Twitter: 'twitter',
    }[service] || ''
  )
}

function _rawResultToId(serviceName: string, serviceUsername: string): Constants.SearchResultId {
  if (serviceName.toLowerCase() === 'keybase' || serviceName === '') {
    return serviceUsername
  }
  return `${serviceUsername}@${serviceName}`
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
      rightIcon: serviceIdToIcon(service.service_name),
      rightService: Constants.serviceIdToService(service.service_name),
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

  throw new SearchError(`Invalid raw result for keybase. Missing result.keybase ${JSON.stringify(result)}`)
}

function _parseThirdPartyRawResult(result: RawResult): Constants.SearchResult {
  if (result.service && result.keybase) {
    const {service, keybase} = result
    return {
      id: _rawResultToId(service.service_name, service.username),
      leftIcon: serviceIdToLogo24(service.service_name),
      leftUsername: service.username,
      leftService: Constants.serviceIdToService(service.service_name),

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
      leftIcon: serviceIdToLogo24(service.service_name),
      leftUsername: service.username,
      leftService: Constants.serviceIdToService(service.service_name),

      rightFullname: service.full_name,
      rightIcon: null,
      rightService: null,
      rightUsername: null,
    }
  }

  throw new SearchError(
    `Invalid raw result for service search. Missing result.service ${JSON.stringify(result)}`
  )
}

function _parseRawResultToRow(result: RawResult, service: Constants.Service) {
  if (service === '' || service === 'Keybase') {
    return _parseKeybaseRawResult(result)
  } else {
    return _parseThirdPartyRawResult(result)
  }
}

function _parseSuggestion(username: string) {
  return {
    id: _rawResultToId('keybase', username),
    leftIcon: serviceIdToLogo24('keybase'),
    leftUsername: username,
    leftService: Constants.serviceIdToService('keybase'),
    // TODO get this from the service
    rightFullname: '',
    rightIcon: null,
    rightService: null,
    rightUsername: null,
  }
}

function _apiSearch(searchTerm: string, service: string = '', limit: number = 20) {
  service = service === 'Keybase' ? '' : service
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

function* search<T>({
  payload: {term, service, pendingActionTypeToFire, finishedActionTypeToFire},
}: Constants.Search<T>) {
  const searchQuery = _toSearchQuery(service, term)
  const cachedResults = yield select(Selectors.cachedSearchResults, searchQuery)
  if (cachedResults) {
    yield put(Creators.finishedSearch(finishedActionTypeToFire, cachedResults, term, service))
    return
  }

  yield put(Creators.pendingSearch(pendingActionTypeToFire, true))

  try {
    yield call(onIdlePromise, 1e3)
    const searchResults = yield call(_apiSearch, term, _serviceToApiServiceName(service))
    const rows = searchResults.list.map((result: RawResult) => {
      return _parseRawResultToRow(result, service || 'Keybase')
    })
    // Make a version that maps from keybase id to SearchResult.
    // This is in case we want to lookup this data by their keybase id. (like the case of upgrading a 3rd party result to a kb result)
    const kbRows: Array<Constants.SearchResult> = rows.filter(r => r.rightService === 'Keybase').map(r => ({
      id: r.rightUsername || '',
      leftService: 'Keybase',
      leftUsername: r.rightUsername,
      leftIcon: null,
    }))
    yield put(EntityAction.mergeEntity(['searchResults'], keyBy(rows, 'id')))
    yield put(EntityAction.mergeEntity(['searchResults'], keyBy(kbRows, 'id')))

    const ids = rows.map(r => r.id)
    yield put(EntityAction.mergeEntity(['searchQueryToResult'], {[searchQuery]: ids}))
    yield put(Creators.finishedSearch(finishedActionTypeToFire, ids, term, service))
  } catch (error) {
    console.warn('error in searching', error)
  } finally {
    yield put(Creators.pendingSearch(pendingActionTypeToFire, false))
  }
}

function* searchSuggestions<T>({payload: {actionTypeToFire, maxUsers}}: Constants.SearchSuggestions<T>) {
  const suggestions: Array<InterestingPerson> = yield call(userInterestingPeopleRpcPromise, {
    param: {
      maxUsers,
    },
  })

  if (suggestions) {
    const rows = suggestions.map(person => _parseSuggestion(person.username))
    const ids = rows.map(r => r.id)

    yield put(EntityAction.mergeEntity(['searchResults'], keyBy(rows, 'id')))
    yield put(Creators.finishedSearch(actionTypeToFire, ids, '', 'Keybase', true))
  }
}

function* searchV3Saga(): SagaGenerator<any, any> {
  yield Saga.safeTakeLatest('searchv3:search', search)
  yield Saga.safeTakeLatest('searchv3:searchSuggestions', searchSuggestions)
}

export default searchV3Saga
