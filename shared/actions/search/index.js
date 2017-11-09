// @flow
import * as Constants from '../../constants/search'
import * as Creators from './creators'
import * as EntityAction from '../entities'
import * as I from 'immutable'
import * as RPCTypes from '../../constants/types/flow-types'
import * as Saga from '../../util/saga'
import * as Selectors from '../../constants/selectors'
import isEqual from 'lodash/isEqual'
import keyBy from 'lodash/keyBy'
import trim from 'lodash/trim'
import {SearchError} from '../../util/errors'
import {onIdlePromise} from '../../util/idle-callback'
import {serviceIdToIcon, serviceIdToLogo24} from '../../util/platforms'

import type {ServiceId} from '../../util/platforms'
import type {ReturnValue} from '../../constants/types/more'

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

function _apiSearch(searchTerm: string, service: string = '', limit: number = 20): Promise<Array<RawResult>> {
  service = service === 'Keybase' ? '' : service
  return RPCTypes.apiserverGetWithSessionRpcPromise({
    args: [
      {key: 'q', value: trim(searchTerm)},
      {key: 'num_wanted', value: String(limit)},
      {key: 'service', value: service},
    ],
    endpoint: 'user/user_search',
  }).then(results => JSON.parse(results.body))
}

function* search({payload: {term, service, searchKey}}: Constants.Search) {
  const searchQuery = _toSearchQuery(service, term)
  const cachedResults = yield Saga.select(Selectors.cachedSearchResults, searchQuery)
  if (cachedResults) {
    yield Saga.put(Creators.finishedSearch(searchKey, cachedResults, term, service))
    yield Saga.put(
      EntityAction.replaceEntity(['search', 'searchKeyToResults'], I.Map({[searchKey]: cachedResults}))
    )
    return
  }

  yield Saga.put(EntityAction.replaceEntity(['search', 'searchKeyToPending'], I.Map({[searchKey]: true})))

  try {
    yield Saga.call(onIdlePromise, 1e3)
    const searchResults = yield Saga.call(_apiSearch, term, _serviceToApiServiceName(service))
    const rows = searchResults.list.map((result: RawResult) =>
      Constants.makeSearchResult(_parseRawResultToRow(result, service || 'Keybase'))
    )

    // Make a version that maps from keybase id to SearchResult.
    // This is in case we want to lookup this data by their keybase id.
    // (like the case of upgrading a 3rd party result to a kb result)
    const kbRows: Array<Constants.SearchResult> = rows.filter(r => r.rightService === 'Keybase').map(r => ({
      id: r.rightUsername || '',
      leftService: 'Keybase',
      leftUsername: r.rightUsername,
      leftIcon: null,
    }))
    yield Saga.put(EntityAction.mergeEntity(['search', 'searchResults'], I.Map(keyBy(rows, 'id'))))
    yield Saga.put(EntityAction.mergeEntity(['search', 'searchResults'], I.Map(keyBy(kbRows, 'id'))))

    const ids = rows.map(r => r.id)
    yield Saga.put(
      EntityAction.mergeEntity(['search', 'searchQueryToResult'], I.Map({[searchQuery]: I.List(ids)}))
    )
    yield Saga.put(Creators.finishedSearch(searchKey, ids, term, service))
    yield Saga.all([
      Saga.put(
        EntityAction.replaceEntity(['search', 'searchKeyToResults'], I.Map({[searchKey]: I.List(ids)}))
      ),
      Saga.put(
        EntityAction.replaceEntity(['search', 'searchKeyToShowSearchSuggestion'], I.Map({[searchKey]: false}))
      ),
    ])
  } catch (error) {
    console.warn('error in searching', error)
  } finally {
    yield Saga.put(EntityAction.replaceEntity(['search', 'searchKeyToPending'], I.Map({[searchKey]: false})))
  }
}

function* searchSuggestions({payload: {maxUsers, searchKey}}: Constants.SearchSuggestions) {
  let suggestions: Array<
    RPCTypes.InterestingPerson
  > = yield Saga.call(RPCTypes.userInterestingPeopleRpcPromise, {
    maxUsers,
  })

  // No search results (e.g. this user doesn't follow/chat anyone)
  suggestions = suggestions || []

  const rows = suggestions.map(person => Constants.makeSearchResult(_parseSuggestion(person.username)))
  const ids = rows.map(r => r.id)

  yield Saga.put(EntityAction.mergeEntity(['search', 'searchResults'], I.Map(keyBy(rows, 'id'))))
  yield Saga.all([
    Saga.put(EntityAction.replaceEntity(['search', 'searchKeyToResults'], I.Map({[searchKey]: I.List(ids)}))),
    Saga.put(
      EntityAction.replaceEntity(['search', 'searchKeyToShowSearchSuggestion'], I.Map({[searchKey]: true}))
    ),
  ])
  yield Saga.put(Creators.finishedSearch(searchKey, ids, '', 'Keybase', true))
}

function* updateSelectedSearchResult({payload: {searchKey, id}}: Constants.UpdateSelectedSearchResult) {
  yield Saga.put(EntityAction.replaceEntity(['search', 'searchKeyToSelectedId'], I.Map({[searchKey]: id})))
}

function* addResultsToUserInput({payload: {searchKey, searchResults}}: Constants.AddResultsToUserInput) {
  const [oldIds, searchResultMap]: [
    ReturnValue<typeof Constants.getUserInputItemIds>,
    ReturnValue<typeof Selectors.searchResultMapSelector>,
  ] = yield Saga.all([
    Saga.select(Constants.getUserInputItemIds, {searchKey}),
    Saga.select(Selectors.searchResultMapSelector),
  ])

  const maybeUpgradedUsers = searchResults.map(u =>
    Constants.maybeUpgradeSearchResultIdToKeybaseId(searchResultMap, u)
  )
  yield Saga.put.resolve(
    EntityAction.mergeEntity(
      ['search', 'searchKeyToUserInputItemIds'],
      I.Map({
        [searchKey]: I.OrderedSet(maybeUpgradedUsers),
      })
    )
  )
  const ids = yield Saga.select(Constants.getUserInputItemIds, {searchKey})
  if (!isEqual(oldIds, ids)) {
    yield Saga.put(Creators.userInputItemsUpdated(searchKey, ids))
  }
}

function* removeResultsToUserInput({
  payload: {searchKey, searchResults},
}: Constants.RemoveResultsToUserInput) {
  const oldIds = yield Saga.select(Constants.getUserInputItemIds, {searchKey})
  yield Saga.put.resolve(
    EntityAction.subtractEntity(['search', 'searchKeyToUserInputItemIds', searchKey], I.List(searchResults))
  )
  const ids = yield Saga.select(Constants.getUserInputItemIds, {searchKey})
  if (!isEqual(oldIds, ids)) {
    yield Saga.put(Creators.userInputItemsUpdated(searchKey, ids))
  }
}

function* setUserInputItems({payload: {searchKey, searchResults}}: Constants.SetUserInputItems) {
  const ids = yield Saga.select(Constants.getUserInputItemIds, {searchKey})
  if (!isEqual(ids, searchResults)) {
    yield Saga.put.resolve(
      EntityAction.replaceEntity(
        ['search', 'searchKeyToUserInputItemIds'],
        I.Map({
          [searchKey]: I.OrderedSet(searchResults),
        })
      )
    )
    yield Saga.put(Creators.userInputItemsUpdated(searchKey, searchResults))
  }
}

function* clearSearchResults({payload: {searchKey}}: Constants.ClearSearchResults) {
  yield Saga.put(EntityAction.replaceEntity(['search', 'searchKeyToResults'], I.Map({[searchKey]: null})))
  yield Saga.put(
    EntityAction.replaceEntity(
      ['search', 'searchKeyToSearchResultQuery'],
      I.Map({
        [searchKey]: null,
      })
    )
  )
}

function* finishedSearch({payload: {searchKey, searchResultTerm, service}}) {
  yield Saga.put(
    EntityAction.replaceEntity(
      ['search', 'searchKeyToSearchResultQuery'],
      I.Map({
        [searchKey]: {text: searchResultTerm, service},
      })
    )
  )
}

function* clearSearchTextInput({payload: {searchKey}}: Constants.UserInputItemsUpdated) {
  const clearSearchTextInput = yield Saga.select(Constants.getClearSearchTextInput, {searchKey})
  yield Saga.put(
    EntityAction.replaceEntity(
      ['search', 'searchKeyToClearSearchTextInput'],
      I.Map({
        [searchKey]: clearSearchTextInput + 1,
      })
    )
  )
}

function* searchSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeLatest('search:search', search)
  yield Saga.safeTakeLatest('search:searchSuggestions', searchSuggestions)
  yield Saga.safeTakeLatest('search:updateSelectedSearchResult', updateSelectedSearchResult)
  yield Saga.safeTakeLatest('search:addResultsToUserInput', addResultsToUserInput)
  yield Saga.safeTakeLatest('search:removeResultsToUserInput', removeResultsToUserInput)
  yield Saga.safeTakeLatest('search:setUserInputItems', setUserInputItems)
  yield Saga.safeTakeLatest('search:clearSearchResults', clearSearchResults)
  yield Saga.safeTakeLatest('search:finishedSearch', finishedSearch)
  yield Saga.safeTakeLatest('search:userInputItemsUpdated', clearSearchTextInput)
}

export default searchSaga
