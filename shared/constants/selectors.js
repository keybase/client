// @flow
import {createSelector} from 'reselect'

import type {TypedState} from './reducer'
import type {SearchQuery} from './searchv3'

const usernameSelector = ({config: {username}}: TypedState) => username
const loggedInSelector = ({config: {loggedIn}}: TypedState) => loggedIn

// $FlowIssue with accessing records
const cachedSearchResults = ({entities: {searchQueryToResult}}: TypedState, searchQuery: SearchQuery) =>
  searchQueryToResult.get(searchQuery)

const inboxSearchSelector = ({chat: {inboxSearch}}: TypedState) => inboxSearch
const profileSearchResultArray = createSelector(
  ({profile: {searchResults}}: TypedState) => searchResults,
  searchResults => (searchResults ? searchResults.toArray() : [])
)
export {
  cachedSearchResults,
  inboxSearchSelector,
  loggedInSelector,
  profileSearchResultArray,
  usernameSelector,
}
