// Not use util/container as we have import loops otherwise
import {TypedState} from './reducer'
import {SearchQuery} from './types/search'

const cachedSearchResults = (
  {
    entities: {
      search: {searchQueryToResult},
    },
  }: TypedState,
  searchQuery: SearchQuery
) => searchQueryToResult.get(searchQuery)

const searchResultSelector = (
  {
    entities: {
      search: {searchResults},
    },
  }: TypedState,
  username: string
) => {
  return searchResults.get(username)
}

const amIFollowing = (state: TypedState, otherUser: string) => state.config.following.has(otherUser)
const amIBeingFollowed = (state: TypedState, otherUser: string) => state.config.followers.has(otherUser)
const searchResultMapSelector = (state: TypedState) => state.entities.search.searchResults

export {amIBeingFollowed, amIFollowing, cachedSearchResults, searchResultMapSelector, searchResultSelector}
