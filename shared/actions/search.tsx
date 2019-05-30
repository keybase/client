import logger from '../logger'
import * as Constants from '../constants/search'
import * as Types from '../constants/types/search'
import * as SearchGen from './search-gen'
import * as EntitiesGen from './entities-gen'
import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import * as Selectors from '../constants/selectors'
import {keyBy, trim} from 'lodash-es'
import {onIdlePromise} from '../util/idle-callback'
import {ServiceId, serviceIdToIcon, serviceIdToLogo24} from '../util/platforms'

type RawResult = {
  score: number
  keybase: {
    username: string
    uid: string
    picture_url: string | null
    full_name: string | null
    is_followee: boolean
  } | null
  service: {
    service_name: ServiceId
    username: string
    picture_url: string | null
    bio: string | null
    location: string | null
    full_name: string | null
  } | null
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
      leftFullname: keybase.full_name,
      leftIcon: null,
      leftService: 'Keybase',

      leftUsername: keybase.username,
      rightIcon: serviceIdToIcon(service.service_name),
      rightService: Constants.serviceIdToService(service.service_name),
      rightUsername: service.username,
    }
  }

  if (result.keybase) {
    const {keybase} = result
    return {
      id: _rawResultToId('Keybase', keybase.username),
      leftFullname: keybase.full_name,
      leftIcon: null,
      leftService: 'Keybase',

      leftUsername: keybase.username,
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
      leftFullname: keybase.full_name,
      leftIcon: serviceIdToLogo24(service.service_name),
      leftService: Constants.serviceIdToService(service.service_name),

      leftUsername: service.username,
      rightIcon: null,
      rightService: 'Keybase',
      rightUsername: keybase.username,
    }
  }

  if (result.service) {
    const service = result.service
    return {
      id: _rawResultToId(service.service_name, service.username),
      leftFullname: service.full_name,
      leftIcon: serviceIdToLogo24(service.service_name),
      leftService: Constants.serviceIdToService(service.service_name),

      leftUsername: service.username,
      rightIcon: null,
      rightService: null,
      rightUsername: null,
    }
  }

  throw new Error(`Invalid raw result for service search. Missing result.service ${JSON.stringify(result)}`)
}

function _parseRawResultToRow(result: RawResult, service: Types.Service) {
  // @ts-ignore (old flow issue) shouldn't accept a '' but this logic exists and i don't want to test removing it
  if (service === '' || service === 'Keybase') {
    return _parseKeybaseRawResult(result)
  } else {
    return _parseThirdPartyRawResult(result)
  }
}

function _parseSuggestion(username: string, fullname: string) {
  return {
    id: _rawResultToId('keybase', username),
    leftFullname: fullname,
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
  }).then(results => JSON.parse(results.body).list || [])
}

function* search(state, {payload: {term, service, searchKey}}) {
  const searchQuery = _toSearchQuery(service, term)
  const cachedResults = Selectors.cachedSearchResults(state, searchQuery)
  if (cachedResults) {
    yield Saga.put(
      SearchGen.createFinishedSearch({
        searchKey,
        searchResultTerm: term,
        searchResults: cachedResults.toArray(),
        service,
      })
    )
    yield Saga.put(
      EntitiesGen.createReplaceEntity({
        entities: I.Map({[searchKey]: cachedResults}),
        keyPath: ['search', 'searchKeyToResults'],
      })
    )
    return
  }

  yield Saga.put(
    EntitiesGen.createReplaceEntity({
      entities: I.Map({[searchKey]: true}),
      keyPath: ['search', 'searchKeyToPending'],
    })
  )

  try {
    yield Saga.callUntyped(onIdlePromise, 1e3)
    const searchResults = yield* Saga.callPromise(_apiSearch, term, _serviceToApiServiceName(service))
    const rows = searchResults.map((result: RawResult) =>
      Constants.makeSearchResult(_parseRawResultToRow(result, service || 'Keybase'))
    )

    // Make a version that maps from keybase id to SearchResult.
    // This is in case we want to lookup this data by their keybase id.
    // (like the case of upgrading a 3rd party result to a kb result)
    const kbRows = rows
      .filter(r => r.rightService === 'Keybase')
      .map(r =>
        Constants.makeSearchResult({
          id: r.rightUsername || '',
          leftIcon: null,
          leftService: 'Keybase',
          leftUsername: r.rightUsername || '',
        })
      )
    yield Saga.put(
      EntitiesGen.createMergeEntity({
        entities: I.Map(keyBy(rows, 'id')),
        keyPath: ['search', 'searchResults'],
      })
    )
    yield Saga.put(
      EntitiesGen.createMergeEntity({
        entities: I.Map(keyBy(kbRows, 'id')),
        keyPath: ['search', 'searchResults'],
      })
    )

    const ids = rows.map(r => r.id)
    yield Saga.put(
      EntitiesGen.createMergeEntity({
        entities: I.Map({[searchQuery]: I.List(ids)}),
        keyPath: ['search', 'searchQueryToResult'],
      })
    )
    yield Saga.put(
      SearchGen.createFinishedSearch({searchKey, searchResultTerm: term, searchResults: ids, service})
    )
    yield Saga.sequentially([
      Saga.put(
        EntitiesGen.createReplaceEntity({
          entities: I.Map({[searchKey]: I.List(ids)}),
          keyPath: ['search', 'searchKeyToResults'],
        })
      ),
      Saga.put(
        EntitiesGen.createReplaceEntity({
          entities: I.Map({[searchKey]: false}),
          keyPath: ['search', 'searchKeyToShowSearchSuggestion'],
        })
      ),
    ])
  } catch (error) {
    logger.warn('error in searching', error)
  } finally {
    yield Saga.put(
      EntitiesGen.createReplaceEntity({
        entities: I.Map({[searchKey]: false}),
        keyPath: ['search', 'searchKeyToPending'],
      })
    )
  }
}

const searchSuggestions = (_, {payload: {maxUsers, searchKey}}: SearchGen.SearchSuggestionsPayload) =>
  RPCTypes.userInterestingPeopleRpcPromise({
    maxUsers: maxUsers || 50,
  }).then(suggestions => {
    // No search results (e.g. this user doesn't follow/chat anyone)
    const rows = (suggestions || []).map(person =>
      Constants.makeSearchResult(_parseSuggestion(person.username, person.fullname))
    )
    const ids = rows.map(r => r.id)

    return [
      EntitiesGen.createMergeEntity({
        entities: I.Map(keyBy(rows, 'id')),
        keyPath: ['search', 'searchResults'],
      }),
      EntitiesGen.createReplaceEntity({
        entities: I.Map({[searchKey]: true}),
        keyPath: ['search', 'searchKeyToShowSearchSuggestion'],
      }),
      EntitiesGen.createReplaceEntity({
        entities: I.Map({[searchKey]: I.List(ids)}),
        keyPath: ['search', 'searchKeyToResults'],
      }),
      SearchGen.createFinishedSearch({
        searchKey,
        searchResultTerm: '',
        searchResults: ids,
        searchShowingSuggestions: true,
        service: 'Keybase',
      }),
    ]
  })

const updateSelectedSearchResult = (_, {payload: {searchKey, id}}) =>
  EntitiesGen.createReplaceEntity({
    entities: I.Map({[searchKey]: id}),
    keyPath: ['search', 'searchKeyToSelectedId'],
  })

function* addResultsToUserInput(state, {payload: {searchKey, searchResults}}) {
  const oldIds = Constants.getUserInputItemIds(state, searchKey)
  const searchResultMap = Selectors.searchResultMapSelector(state)
  const maybeUpgradedUsers = searchResults.map(u =>
    Constants.maybeUpgradeSearchResultIdToKeybaseId(searchResultMap, u)
  )
  yield Saga.put.resolve(
    EntitiesGen.createMergeEntity({
      entities: I.Map({
        [searchKey]: I.OrderedSet(maybeUpgradedUsers),
      }),
      keyPath: ['search', 'searchKeyToUserInputItemIds'],
    })
  )
  const newState = yield* Saga.selectState()
  const ids = Constants.getUserInputItemIds(newState, searchKey)
  if (!oldIds.equals(ids)) {
    yield Saga.put(SearchGen.createUserInputItemsUpdated({searchKey, userInputItemIds: ids.toArray()}))
  }
}

function* removeResultsToUserInput(state, {payload: {searchKey, searchResults}}) {
  const oldIds = Constants.getUserInputItemIds(state, searchKey)
  yield Saga.put.resolve(
    EntitiesGen.createSubtractEntity({
      entities: I.List(searchResults),
      keyPath: ['search', 'searchKeyToUserInputItemIds', searchKey],
    })
  )
  const newState = yield* Saga.selectState()
  const ids = Constants.getUserInputItemIds(newState, searchKey)
  if (!oldIds.equals(ids)) {
    yield Saga.put(SearchGen.createUserInputItemsUpdated({searchKey, userInputItemIds: ids.toArray()}))
  }
}

function* setUserInputItems(state, {payload: {searchKey, searchResults}}) {
  const ids = Constants.getUserInputItemIds(state, searchKey)
  if (!ids.equals(I.OrderedSet(searchResults))) {
    yield Saga.put.resolve(
      EntitiesGen.createReplaceEntity({
        entities: I.Map({
          [searchKey]: I.OrderedSet(searchResults),
        }),
        keyPath: ['search', 'searchKeyToUserInputItemIds'],
      })
    )
    yield Saga.put(SearchGen.createUserInputItemsUpdated({searchKey, userInputItemIds: searchResults}))
  }
}

const clearSearchResults = (_, {payload: {searchKey}}) => [
  EntitiesGen.createReplaceEntity({
    entities: I.Map({[searchKey]: null}),
    keyPath: ['search', 'searchKeyToResults'],
  }),
  EntitiesGen.createReplaceEntity({
    entities: I.Map({
      [searchKey]: null,
    }),
    keyPath: ['search', 'searchKeyToSearchResultQuery'],
  }),
]

const finishedSearch = (_, {payload: {searchKey, searchResultTerm, service}}) =>
  EntitiesGen.createReplaceEntity({
    entities: I.Map({
      [searchKey]: {service, text: searchResultTerm},
    }),
    keyPath: ['search', 'searchKeyToSearchResultQuery'],
  })

const maybeNewSearch = (state, {payload: {searchKey}}) => {
  // When you select a search result, we want to clear the shown results and
  // start back with new recommendations, *unless* you're building a convo,
  // in which case we're showing any convo you selected by choosing a result.
  return [SearchGen.createClearSearchResults({searchKey}), SearchGen.createSearchSuggestions({searchKey})]
}

const clearSearchTextInput = (state, {payload: {searchKey}}: SearchGen.UserInputItemsUpdatedPayload) => {
  const clearSearchTextInput = Constants.getClearSearchTextInput(state, searchKey)
  return EntitiesGen.createReplaceEntity({
    entities: I.Map({
      [searchKey]: clearSearchTextInput + 1,
    }),
    keyPath: ['search', 'searchKeyToClearSearchTextInput'],
  })
}

function* searchSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainGenerator<SearchGen.SearchPayload>(SearchGen.search, search)
  yield* Saga.chainAction<SearchGen.SearchSuggestionsPayload>(SearchGen.searchSuggestions, searchSuggestions)
  yield* Saga.chainAction<SearchGen.UpdateSelectedSearchResultPayload>(
    SearchGen.updateSelectedSearchResult,
    updateSelectedSearchResult
  )
  yield* Saga.chainGenerator<SearchGen.AddResultsToUserInputPayload>(
    SearchGen.addResultsToUserInput,
    addResultsToUserInput
  )
  yield* Saga.chainGenerator<SearchGen.RemoveResultsToUserInputPayload>(
    SearchGen.removeResultsToUserInput,
    removeResultsToUserInput
  )
  yield* Saga.chainGenerator<SearchGen.SetUserInputItemsPayload>(
    SearchGen.setUserInputItems,
    setUserInputItems
  )
  yield* Saga.chainAction<SearchGen.ClearSearchResultsPayload>(
    SearchGen.clearSearchResults,
    clearSearchResults
  )
  yield* Saga.chainAction<SearchGen.FinishedSearchPayload>(SearchGen.finishedSearch, finishedSearch)
  yield* Saga.chainAction<SearchGen.UserInputItemsUpdatedPayload>(
    SearchGen.userInputItemsUpdated,
    clearSearchTextInput
  )
  yield* Saga.chainAction<SearchGen.UserInputItemsUpdatedPayload>(
    SearchGen.userInputItemsUpdated,
    maybeNewSearch
  )
}

export default searchSaga
