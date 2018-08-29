// @flow
import * as I from 'immutable'
import * as Types from './types/team-building'

class SearchCache {
  userMap: I.Map<Types.UserID, Types.User>
  searchCacheMap: I.Map<Types.SearchString, I.Set<Types.UserID>>
  searchBuffer: Array<Types.SearchString>
  cacheSize: number

  constructor(cacheSize: number) {
    this.cacheSize = cacheSize
    this.searchBuffer = []
    this.searchCacheMap = I.Map()
    this.userMap = I.Map()
  }

  getSearchCache = (search: Types.SearchString): Array<Types.UserID> => {
    return this.searchCacheMap.get(search, I.Set()).toArray()
  }

  getUserInfo = (id: Types.UserID): ?Types.User => {
    return this.userMap.get(id)
  }

  getUsersInfo = (ids: Array<Types.UserID>): Array<?Types.User> => {
    return ids.map(this.getUserInfo).filter(v => !!v)
  }

  hasSearchQuery = (searchQuery: Types.SearchString): boolean => {
    return this.searchCacheMap.has(searchQuery)
  }

  addSearchResult = (searchQuery: Types.SearchString, results: Array<Types.User>): void => {
    // We've hit our cache size limit, let's remote the oldest search result
    this.searchBuffer.push(searchQuery)
    if (this.searchBuffer.length >= this.cacheSize) {
      let searchQueryToRemove = this.searchBuffer.splice(0, 1)[0] // pop from the front
      this._removeSearchResultFromCache(searchQueryToRemove)
    }

    let toMergeUserMap = results.reduce((acc, v) => {
      acc[v.id] = v
      return acc
    }, {})
    this.userMap = this.userMap.merge(toMergeUserMap)
    this.searchCacheMap = this.searchCacheMap.set(searchQuery, I.Set(results.map(u => u.id)))
  }

  _unusedId = (id: Types.UserID): boolean => {
    return this.searchCacheMap.some(searchResultIds => !searchResultIds.has(id))
  }

  _removeSearchResultFromCache = (searchQuery: Types.SearchString) => {
    const idsToMaybeClear = this.getSearchCache(searchQuery)
    this.searchCacheMap = this.searchCacheMap.delete(searchQuery)
    // Figure out if these ids are present anywhere else
    let idsToClear = idsToMaybeClear.filter(this._unusedId)
    this.userMap = this.userMap.deleteAll(idsToClear)
  }
}

class ServiceResultCountCache {
  searchBuffer: Array<Types.SearchString>
  cacheSize: number
  cache: {[key: Types.SearchString]: {[key: string]: number}}

  constructor(cacheSize: number) {
    this.cacheSize = cacheSize
    this.searchBuffer = []
    this.cache = {}
  }

  hasSearchQuery = (search: Types.SearchString): boolean => {
    return !!this.cache[search]
  }

  getCache = (search: Types.SearchString): ?{[key: string]: number} => {
    return this.cache[search]
  }

  addSearchResult = (searchQuery: Types.SearchString, counts: {[key: string]: number}): void => {
    this.searchBuffer.push(searchQuery)
    if (this.searchBuffer.length >= this.cacheSize) {
      let searchQueryToRemove = this.searchBuffer.splice(0, 1)[0] // pop from the front
      this._removeSearchResultFromCache(searchQueryToRemove)
    }
  }

  _removeSearchResultFromCache = (searchQuery: Types.SearchString) => {
    delete this.cache[searchQuery]
  }
}

export const makeState: I.RecordFactory<Types._State> = I.Record({
  searchCache: new SearchCache(10),
  searchQuery: null,
  serviceResultCountCache: new ServiceResultCountCache(10),
  teamSoFar: I.Set(),
})
