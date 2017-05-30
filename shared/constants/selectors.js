// @flow
import type {TypedState} from './reducer'
import type {SearchQuery} from './searchv3'

const usernameSelector = ({config: {username}}: TypedState) => username
const loggedInSelector = ({config: {loggedIn}}: TypedState) => loggedIn

const isFollowingFnSelector = ({config: {followers}}: TypedState) => (username: string) =>
  followers && !!followers[username]

// $FlowIssue with accessing records
const cachedSearchResults = ({entities: {searchResults}}: TypedState, searchQuery: SearchQuery) =>
  searchResults.get(searchQuery)

export {cachedSearchResults, usernameSelector, loggedInSelector, isFollowingFnSelector}
