// @flow
import logger from '../logger'
import * as Constants from '../constants/search'
import * as Types from '../constants/types/search'
import * as SearchGen from './search-gen'
import * as EntitiesGen from './entities-gen'
import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import * as Selectors from '../constants/selectors'
import  keyBy, trim} from 'lodash-es'
import {onIdlePromise} from '../util/idle-callback'
import {serviceIdToIcon, serviceIdToLogo24} from '../util/platforms'

import type {TypedState} from '../constants/reducer'
import type {ServiceId} from '../util/platforms'

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

function _serviceToApiServiceName(service: Types.Service): string {
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

function _rawResultToId(serviceName: string, serviceUsername: string): Types.SearchResultId {
  if (serviceName.toLowerCase() === 'keybase' || serviceName === '') {
    return serviceUsername
  }
  return `${serviceUsername}@${serviceName}`
}

function _toSearchQuery(serviceName: string, searchTerm: string): Types.SearchQuery {
  return `${serviceName}-${searchTerm}`
}

function _parseKeybaseRawResult(result: RawResult): Types.SearchResult {
  if (result.keybase && result.service) {
    const {keybase, service} = result
    return {
      id: _rawResultToId('Keybase', keybase.username),
      leftIcon: null,
      leftUsername: keybase.username,
      leftService: 'Keybase',

      leftFullname: keybase.full_name,
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

      leftFullname: keybase.full_name,
      rightIcon: null,
      rightService: null,
      rightUsername: null,
    }
  }

  throw new Error(`Invalid raw result for keybase. Missing result.keybase ${JSON.stringify(result)}`)
}

function _parseThirdPartyRawResult(result: RawResult): Types.SearchResult {
  if (result.service && result.keybase) {
    const {service, keybase} = result
    return {
      id: _rawResultToId(service.service_name, service.username),
      leftIcon: serviceIdToLogo24(service.service_name),
      leftUsername: service.username,
      leftService: Constants.serviceIdToService(service.service_name),

      leftFullname: keybase.full_name,
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

      leftFullname: service.full_name,
      rightIcon: null,
      rightService: null,
      rightUsername: null,
    }
  }

  throw new Error(`Invalid raw result for service search. Missing result.service ${JSON.stringify(result)}`)
}

function _parseRawResultToRow(result: RawResult, service: Types.Service) {
  // $FlowIssue shouldn't accept a '' but this logic exists and i don't want to test removing it
  if (service === '' || service === 'Keybase') {
    return _parseKeybaseRawResult(result)
  } else {
    return _parseThirdPartyRawResult(result)
  }
}

function _parseSuggestion(username: string) {
  return {
    id: _rawResultToId('keybase', username),
    // TODO get this from the service
    leftFullname: '',
    leftIcon: serviceIdToLogo24('keybase'),
    leftService: Constants.serviceIdToService('keybase'),
    leftUsername: username,
    rightIcon: null,
    rightService: null,
    rightUsername: null,
  }
}

function _apiSearch(searchTerm: string, service: string = '', limit: number = 20): Promise<Array<RawResult>> {
  return RPCTypes.apiserverGetWithSessionRpcPromise({
    args: [
      {key: 'q', value: trim(searchTerm)},
      {key: 'num_wanted', value: String(limit)},
      {key: 'service', value: service === 'Keybase' ? '' : service},
    ],
    endpoint: 'user/user_search',
  }).then(results => JSON.parse(results.body))
}

function* search({payload: {term, service, searchKey}}: SearchGen.SearchPayload) {
  const state: TypedState = yield Saga.select()
  const searchQuery = _toSearchQuery(service, term)
  const cachedResults = Selectors.cachedSearchResults(state, searchQuery)
  if (cachedResults) {
    yield Saga.put(
      SearchGen.createFinishedSearch({
        searchKey,
        searchResults: cachedResults.toArray(),
        searchResultTerm: term,
        service,
      })
    )
    yield Saga.put(
      EntitiesGen.createReplaceEntity({
        keyPath: ['search', 'searchKeyToResults'],
        entities: I.Map({[searchKey]: cachedResults}),
      })
    )
    return
  }

  yield Saga.put(
    EntitiesGen.createReplaceEntity({
      keyPath: ['search', 'searchKeyToPending'],
      entities: I.Map({[searchKey]: true}),
    })
  )

  try {
    yield Saga.call(onIdlePromise, 1e3)
    const searchResults = yield Saga.call(_apiSearch, term, _serviceToApiServiceName(service))
    const rows = searchResults.list.map((result: RawResult) =>
      Constants.makeSearchResult(_parseRawResultToRow(result, service || 'Keybase'))
    )

    // Make a version that maps from keybase id to SearchResult.
    // This is in case we want to lookup this data by their keybase id.
    // (like the case of upgrading a 3rd party result to a kb result)
    const kbRows: Array<Types.SearchResult> = rows.filter(r => r.rightService === 'Keybase').map(r =>
      Constants.makeSearchResult({
        id: r.rightUsername || '',
        leftService: 'Keybase',
        leftUsername: r.rightUsername,
        leftIcon: null,
      })
    )
    yield Saga.put(
      EntitiesGen.createMergeEntity({
        keyPath: ['search', 'searchResults'],
        entities: I.Map(keyBy(rows, 'id')),
      })
    )
    yield Saga.put(
      EntitiesGen.createMergeEntity({
        keyPath: ['search', 'searchResults'],
        entities: I.Map(keyBy(kbRows, 'id')),
      })
    )

    const ids = rows.map(r => r.id)
    yield Saga.put(
      EntitiesGen.createMergeEntity({
        keyPath: ['search', 'searchQueryToResult'],
        entities: I.Map({[searchQuery]: I.List(ids)}),
      })
    )
    yield Saga.put(
      SearchGen.createFinishedSearch({searchKey, searchResults: ids, searchResultTerm: term, service})
    )
    yield Saga.sequentially([
      Saga.put(
        EntitiesGen.createReplaceEntity({
          keyPath: ['search', 'searchKeyToResults'],
          entities: I.Map({[searchKey]: I.List(ids)}),
        })
      ),
      Saga.put(
        EntitiesGen.createReplaceEntity({
          keyPath: ['search', 'searchKeyToShowSearchSuggestion'],
          entities: I.Map({[searchKey]: false}),
        })
      ),
    ])
  } catch (error) {
    logger.warn('error in searching', error)
  } finally {
    yield Saga.put(
      EntitiesGen.createReplaceEntity({
        keyPath: ['search', 'searchKeyToPending'],
        entities: I.Map({[searchKey]: false}),
      })
    )
  }
}

function* searchSuggestions({payload: {maxUsers, searchKey}}: SearchGen.SearchSuggestionsPayload) {
  let suggestions: Array<RPCTypes.InterestingPerson> = yield Saga.call(
    RPCTypes.userInterestingPeopleRpcPromise,
    {
      maxUsers: maxUsers || 50,
    }
  )

  // No search results (e.g. this user doesn't follow/chat anyone)
  suggestions = suggestions || []

  const rows = suggestions.map(person => Constants.makeSearchResult(_parseSuggestion(person.username)))
  const ids = rows.map(r => r.id)

  yield Saga.put(
    EntitiesGen.createMergeEntity({keyPath: ['search', 'searchResults'], entities: I.Map(keyBy(rows, 'id'))})
  )
  yield Saga.sequentially([
    Saga.put(
      EntitiesGen.createReplaceEntity({
        keyPath: ['search', 'searchKeyToShowSearchSuggestion'],
        entities: I.Map({[searchKey]: true}),
      })
    ),
    Saga.put(
      EntitiesGen.createReplaceEntity({
        keyPath: ['search', 'searchKeyToResults'],
        entities: I.Map({[searchKey]: I.List(ids)}),
      })
    ),
  ])
  yield Saga.put(
    SearchGen.createFinishedSearch({
      searchKey,
      searchResults: ids,
      searchResultTerm: '',
      service: 'Keybase',
      searchShowingSuggestions: true,
    })
  )
}

const updateSelectedSearchResult = ({
  payload: {searchKey, id},
}: SearchGen.UpdateSelectedSearchResultPayload) =>
  Saga.put(
    EntitiesGen.createReplaceEntity({
      keyPath: ['search', 'searchKeyToSelectedId'],
      entities: I.Map({[searchKey]: id}),
    })
  )

function* addResultsToUserInput({
  payload: {searchKey, searchResults},
}: SearchGen.AddResultsToUserInputPayload) {
  let state: TypedState = yield Saga.select()
  const oldIds = Constants.getUserInputItemIds(state, searchKey)
  const searchResultMap = Selectors.searchResultMapSelector(state)
  const maybeUpgradedUsers = searchResults.map(u =>
    Constants.maybeUpgradeSearchResultIdToKeybaseId(searchResultMap, u)
  )
  yield Saga.put.resolve(
    EntitiesGen.createMergeEntity({
      keyPath: ['search', 'searchKeyToUserInputItemIds'],
      entities: I.Map({
        [searchKey]: I.OrderedSet(maybeUpgradedUsers),
      }),
    })
  )
  state = yield Saga.select()
  const ids = Constants.getUserInputItemIds(state, searchKey)
  if (!oldIds.equals(ids)) {
    yield Saga.put(SearchGen.createUserInputItemsUpdated({searchKey, userInputItemIds: ids.toArray()}))
  }
}

function* removeResultsToUserInput({
  payload: {searchKey, searchResults},
}: SearchGen.RemoveResultsToUserInputPayload) {
  let state: TypedState = yield Saga.select()
  const oldIds = Constants.getUserInputItemIds(state, searchKey)
  yield Saga.put.resolve(
    EntitiesGen.createSubtractEntity({
      keyPath: ['search', 'searchKeyToUserInputItemIds', searchKey],
      entities: I.List(searchResults),
    })
  )
  state = yield Saga.select()
  const ids = Constants.getUserInputItemIds(state, searchKey)
  if (!oldIds.equals(ids)) {
    yield Saga.put(SearchGen.createUserInputItemsUpdated({searchKey, userInputItemIds: ids.toArray()}))
  }
}

function* setUserInputItems({payload: {searchKey, searchResults}}: SearchGen.SetUserInputItemsPayload) {
  const state: TypedState = yield Saga.select()
  const ids = Constants.getUserInputItemIds(state, searchKey)
  if (!ids.equals(I.OrderedSet(searchResults))) {
    yield Saga.put.resolve(
      EntitiesGen.createReplaceEntity({
        keyPath: ['search', 'searchKeyToUserInputItemIds'],
        entities: I.Map({
          [searchKey]: I.OrderedSet(searchResults),
        }),
      })
    )
    yield Saga.put(SearchGen.createUserInputItemsUpdated({searchKey, userInputItemIds: searchResults}))
  }
}

function clearSearchResults({payload: {searchKey}}: SearchGen.ClearSearchResultsPayload) {
  return Saga.sequentially([
    Saga.put(
      EntitiesGen.createReplaceEntity({
        keyPath: ['search', 'searchKeyToResults'],
        entities: I.Map({[searchKey]: null}),
      })
    ),
    Saga.put(
      EntitiesGen.createReplaceEntity({
        keyPath: ['search', 'searchKeyToSearchResultQuery'],
        entities: I.Map({
          [searchKey]: null,
        }),
      })
    ),
  ])
}

const finishedSearch = ({payload: {searchKey, searchResultTerm, service}}) =>
  Saga.put(
    EntitiesGen.createReplaceEntity({
      keyPath: ['search', 'searchKeyToSearchResultQuery'],
      entities: I.Map({
        [searchKey]: {text: searchResultTerm, service},
      }),
    })
  )

function maybeNewSearch({payload: {searchKey}}: SearchGen.UserInputItemsUpdatedPayload, state: TypedState) {
  // When you select a search result, we want to clear the shown results and
  // start back with new recommendations, *unless* you're building a convo,
  // in which case we're showing any convo you selected by choosing a result.
  if (state.chat2.get('pendingMode') === 'searchingForUsers') {
    return
  }
  return Saga.all([
    Saga.put(SearchGen.createClearSearchResults({searchKey})),
    Saga.put(SearchGen.createSearchSuggestions({searchKey})),
  ])
}

function clearSearchTextInput(
  {payload: {searchKey}}: SearchGen.UserInputItemsUpdatedPayload,
  state: TypedState
) {
  const clearSearchTextInput = Constants.getClearSearchTextInput(state, searchKey)
  return Saga.put(
    EntitiesGen.createReplaceEntity({
      keyPath: ['search', 'searchKeyToClearSearchTextInput'],
      entities: I.Map({
        [searchKey]: clearSearchTextInput + 1,
      }),
    })
  )
}

function* searchSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeLatest(SearchGen.search, search)
  yield Saga.safeTakeLatest(SearchGen.searchSuggestions, searchSuggestions)
  yield Saga.safeTakeLatestPure(SearchGen.updateSelectedSearchResult, updateSelectedSearchResult)
  yield Saga.safeTakeLatest(SearchGen.addResultsToUserInput, addResultsToUserInput)
  yield Saga.safeTakeLatest(SearchGen.removeResultsToUserInput, removeResultsToUserInput)
  yield Saga.safeTakeLatest(SearchGen.setUserInputItems, setUserInputItems)
  yield Saga.safeTakeLatestPure(SearchGen.clearSearchResults, clearSearchResults)
  yield Saga.safeTakeLatestPure(SearchGen.finishedSearch, finishedSearch)
  yield Saga.safeTakeLatestPure(SearchGen.userInputItemsUpdated, clearSearchTextInput)
  yield Saga.safeTakeLatestPure(SearchGen.userInputItemsUpdated, maybeNewSearch)
}

export default searchSaga
