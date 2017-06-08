// @flow
import {createSelector} from 'reselect'

import type {TypedState} from './reducer'
import type {SearchQuery} from './searchv3'

const usernameSelector = ({config: {username}}: TypedState) => username
const loggedInSelector = ({config: {loggedIn}}: TypedState) => loggedIn

const cachedSearchResults = ({entities: {searchQueryToResult}}: TypedState, searchQuery: SearchQuery) =>
  searchQueryToResult.get(searchQuery)

const inboxSearchSelector = ({chat: {inboxSearch}}: TypedState) => inboxSearch

const amIFollowing = ({config: {following}}: TypedState, otherUser: string) => following[otherUser]
const amIBeingFollowed = ({config: {followers}}: TypedState, otherUser: string) => followers[otherUser]

const profileSearchResultArray = createSelector(
  ({profile: {searchResults}}: TypedState) => searchResults,
  searchResults => (searchResults ? searchResults.toArray() : [])
)

export {
  amIFollowing,
  amIBeingFollowed,
  cachedSearchResults,
  inboxSearchSelector,
  loggedInSelector,
  profileSearchResultArray,
  usernameSelector,
}
