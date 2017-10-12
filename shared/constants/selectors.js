// @flow
// Not use util/container as we have import loops otherwise
import {createSelector} from 'reselect'
import {type TypedState} from './reducer'
import {type SearchQuery} from './search'

const usernameSelector = ({config: {username}}: TypedState) => username
const loggedInSelector = ({config: {loggedIn}}: TypedState) => loggedIn

const cachedSearchResults = (
  {entities: {search: {searchQueryToResult}}}: TypedState,
  searchQuery: SearchQuery
) => searchQueryToResult.get(searchQuery)

const searchResultSelector = ({entities: {search: {searchResults}}}: TypedState, username: string) => {
  return searchResults.get(username)
}

const previousConversationSelector = ({chat: {previousConversation}}: TypedState) => previousConversation

const amIFollowing = ({config: {following}}: TypedState, otherUser: string) => following[otherUser]
const amIBeingFollowed = ({config: {followers}}: TypedState, otherUser: string) => followers[otherUser]

const searchResultMapSelector = createSelector(
  ({entities: {search: {searchResults}}}: TypedState) => searchResults,
  searchResults => searchResults
)

export {
  amIBeingFollowed,
  amIFollowing,
  cachedSearchResults,
  loggedInSelector,
  previousConversationSelector,
  searchResultMapSelector,
  searchResultSelector,
  usernameSelector,
}
