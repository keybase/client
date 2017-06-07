// @flow
import type {TypedState} from './reducer'
import type {SearchQuery} from './searchv3'

const usernameSelector = ({config: {username}}: TypedState) => username
const loggedInSelector = ({config: {loggedIn}}: TypedState) => loggedIn

// $FlowIssue with accessing records
const cachedSearchResults = ({entities: {searchQueryToResult}}: TypedState, searchQuery: SearchQuery) =>
  searchQueryToResult.get(searchQuery)

const inboxSearchSelector = ({chat: {inboxSearch}}: TypedState) => inboxSearch

export {cachedSearchResults, inboxSearchSelector, loggedInSelector, usernameSelector}
