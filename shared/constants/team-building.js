// @flow
import * as I from 'immutable'
import * as Types from './types/team-building'

// The I.List is used as a tuple
type SearchKey = I.List<Types.SearchString | Types.ServiceIdWithContact>

class SearchCache {
  userMap: I.Map<Types.UserID, Types.User>
  searchCacheMap: I.Map<SearchKey, I.Set<Types.UserID>>
  searchBuffer: Array<Types.SearchKey>
  cacheSize: number

  constructor(cacheSize: number) {
    this.cacheSize = cacheSize
    this.searchBuffer = []
    this.searchCacheMap = I.Map()
    this.userMap = I.Map()
  }

  getSearchCache = (searchKey: SearchKey): Array<Types.UserID> => {
    return this.searchCacheMap.get(searchKey, I.Set()).toArray()
  }

  getUserInfo = (id: Types.UserID): ?Types.User => {
    return this.userMap.get(id)
  }

  getUsersInfo = (ids: Array<Types.UserID>): Array<?Types.User> => {
    return ids.map(this.getUserInfo).filter(v => !!v)
  }

  _keyFn = (search: Types.SearchString, service: Types.ServiceIdWithContact): SearchKey =>
    I.List([search, service])

  hasSearchQuery = (search: Types.SearchString, service: Types.ServiceIdWithContact): boolean => {
    const k = this._keyFn(search, service)
    return this.searchCacheMap.has(k)
  }

  addSearchResult = (
    searchQuery: Types.SearchString,
    service: Types.ServiceIdWithContact,
    results: Array<Types.User>
  ): void => {
    const k = this._keyFn(searchQuery, service)
    // We've hit our cache size limit, let's remote the oldest search result
    this.searchBuffer.push(k)
    if (this.searchBuffer.length >= this.cacheSize) {
      let searchKeyToRemove = this.searchBuffer.splice(0, 1)[0] // pop from the front
      this._removeSearchResultFromCache(searchKeyToRemove)
    }

    let toMergeUserMap = results.reduce((acc, v) => {
      acc[v.id] = v
      return acc
    }, {})
    this.userMap = this.userMap.merge(toMergeUserMap)
    this.searchCacheMap = this.searchCacheMap.set(k, I.Set(results.map(u => u.id)))
  }

  _unusedId = (id: Types.UserID): boolean => {
    return this.searchCacheMap.some(searchResultIds => !searchResultIds.has(id))
  }

  _removeSearchResultFromCache = (searchKey: SearchKey) => {
    const idsToMaybeClear = this.getSearchCache(searchKey)
    this.searchCacheMap = this.searchCacheMap.delete(searchKey)
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

export {ServiceResultCountCache, SearchCache}
