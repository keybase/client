// @flow
import {createSelector, createSelectorCreator, defaultMemoize} from 'reselect'
import isEqualWith from 'lodash/isEqualWith'
import * as I from 'immutable'

import type {TypedState} from './reducer'
import type {SearchQuery} from './search'

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

const userIsInTeam = ({entities: {teams: {teamNameToMemberUsernames}}}: TypedState, teamname: string, username: string) => {
  return teamNameToMemberUsernames.getIn([teamname, username])
}

const searchResultMapSelector = createSelector(
  ({entities: {search: {searchResults}}}: TypedState) => searchResults,
  searchResults => searchResults
)

const createShallowEqualSelector = createSelectorCreator(defaultMemoize, (a, b) =>
  isEqualWith(a, b, (a, b, indexOrKey, object, other, stack) => (stack ? a === b : undefined))
)

const createImmutableEqualSelector = createSelectorCreator(defaultMemoize, I.is)

export {
  amIBeingFollowed,
  amIFollowing,
  cachedSearchResults,
  createShallowEqualSelector,
  createImmutableEqualSelector,
  loggedInSelector,
  previousConversationSelector,
  searchResultMapSelector,
  searchResultSelector,
  userIsInTeam,
  usernameSelector,
}
