// @flow
import {createSelector, createSelectorCreator, defaultMemoize} from 'reselect'
import isEqualWith from 'lodash/isEqualWith'

import type {TypedState} from './reducer'
import type {SearchQuery} from './search'

const usernameSelector = ({config: {username}}: TypedState) => username
const loggedInSelector = ({config: {loggedIn}}: TypedState) => loggedIn

const cachedSearchResults = ({entities: {searchQueryToResult}}: TypedState, searchQuery: SearchQuery) =>
  searchQueryToResult.get(searchQuery)

const searchResultSelector = ({entities: {searchResults}}: TypedState, username: string) =>
  searchResults.get(username).toObject()

const inboxSearchSelector = ({chat: {inboxSearch}}: TypedState) => inboxSearch

const previousConversationSelector = ({chat: {previousConversation}}: TypedState) => previousConversation

const amIFollowing = ({config: {following}}: TypedState, otherUser: string) => following[otherUser]
const amIBeingFollowed = ({config: {followers}}: TypedState, otherUser: string) => followers[otherUser]

const searchResultMapSelector = createSelector(
  ({entities: {searchResults}}: TypedState) => searchResults,
  searchResults => searchResults
)

const chatSearchPending = ({chat: {searchPending}}: TypedState) => searchPending

const chatSearchResultArray = createSelector(
  ({chat: {searchResults}}: TypedState) => searchResults,
  searchResults => (searchResults ? searchResults.toArray() : [])
)

const chatSearchShowingSuggestions = ({chat: {searchShowingSuggestions}}: TypedState) =>
  searchShowingSuggestions

const chatSearchResultTerm = ({chat: {searchResultTerm}}: TypedState) => searchResultTerm

const profileSearchResultArray = createSelector(
  ({profile: {searchResults}}: TypedState) => searchResults,
  searchResults => (searchResults ? searchResults.toArray() : null)
)

const createShallowEqualSelector = createSelectorCreator(defaultMemoize, (a, b) =>
  isEqualWith(a, b, (a, b, indexOrKey, object, other, stack) => (stack ? a === b : undefined))
)

export {
  amIBeingFollowed,
  amIFollowing,
  cachedSearchResults,
  chatSearchPending,
  chatSearchShowingSuggestions,
  chatSearchResultTerm,
  chatSearchResultArray,
  createShallowEqualSelector,
  inboxSearchSelector,
  loggedInSelector,
  previousConversationSelector,
  profileSearchResultArray,
  searchResultMapSelector,
  searchResultSelector,
  usernameSelector,
}
