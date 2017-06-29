// @flow
import {createSelector, createSelectorCreator, defaultMemoize} from 'reselect'
import {isEqualWith} from 'lodash'

import type {TypedState} from './reducer'
import type {SearchQuery} from './searchv3'

const usernameSelector = ({config: {username}}: TypedState) => username
const loggedInSelector = ({config: {loggedIn}}: TypedState) => loggedIn

const cachedSearchResults = ({entities: {searchQueryToResult}}: TypedState, searchQuery: SearchQuery) =>
  searchQueryToResult.get(searchQuery)

const searchResultSelector = ({entities: {searchResults}}: TypedState, username: string) =>
  searchResults.get(username).toObject()

const inboxSearchSelector = ({chat: {inboxSearch}}: TypedState) => inboxSearch

const amIFollowing = ({config: {following}}: TypedState, otherUser: string) => following[otherUser]
const amIBeingFollowed = ({config: {followers}}: TypedState, otherUser: string) => followers[otherUser]

const chatSearchResultArray = createSelector(
  ({chat: {searchResults}}: TypedState) => searchResults,
  searchResults => (searchResults ? searchResults.toArray() : [])
)

const profileSearchResultArray = createSelector(
  ({profile: {searchResults}}: TypedState) => searchResults,
  searchResults => (searchResults ? searchResults.toArray() : null)
)

const createShallowEqualSelector = createSelectorCreator(defaultMemoize, (a, b) =>
  isEqualWith(a, b, (a, b, indexOrKey, object, other, stack) => (stack ? a === b : undefined))
)

export {
  amIFollowing,
  amIBeingFollowed,
  cachedSearchResults,
  chatSearchResultArray,
  createShallowEqualSelector,
  inboxSearchSelector,
  loggedInSelector,
  profileSearchResultArray,
  searchResultSelector,
  usernameSelector,
}
