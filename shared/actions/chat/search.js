// @flow
import * as Creators from './creators'
import * as Constants from '../../constants/chat'
import * as Selectors from '../../constants/selectors'
import * as SearchConstants from '../../constants/search'
import * as SearchCreators from '../search/creators'
import * as Saga from '../../util/saga'
import type {ReturnValue} from '../../constants/types/more'
import type {TypedState} from '../../constants/reducer'

const inSearchSelector = (state: TypedState) => state.chat.get('inSearch')

function* _newChat(action: Constants.NewChat): Saga.SagaGenerator<any, any> {
  yield Saga.put(Creators.setInboxFilter(''))
  const ids = yield Saga.select(SearchConstants.getUserInputItemIds, {searchKey: 'chatSearch'})
  if (ids && !!ids.length) {
    // Ignore 'New Chat' attempts when we're already building a chat
    return
  }
  yield Saga.put(Creators.setPreviousConversation(yield Saga.select(Constants.getSelectedConversation)))
  yield Saga.put(Creators.selectConversation(null, false))
  yield Saga.put(SearchCreators.searchSuggestions('chatSearch'))
}

function _exitSearch(
  {payload: {skipSelectPreviousConversation}}: Constants.ExitSearch,
  [userInputItemIds, previousConversation]: [
    ReturnValue<typeof SearchConstants.getUserInputItemIds>,
    ReturnValue<typeof Selectors.previousConversationSelector>,
  ]
) {
  return Saga.all([
    Saga.put(SearchCreators.clearSearchResults('chatSearch')),
    Saga.put(SearchCreators.setUserInputItems('chatSearch', [])),
    Saga.put(Creators.removeTempPendingConversations()),
    userInputItemIds.length === 0 && !skipSelectPreviousConversation
      ? Saga.put(Creators.selectConversation(previousConversation, false))
      : null,
  ])
}

// TODO this is kinda confusing. I think there is duplicated state...
function* _updateTempSearchConversation(action: SearchConstants.UserInputItemsUpdated) {
  const {payload: {userInputItemIds}} = action
  const [me, inSearch] = yield Saga.all([
    Saga.select(Selectors.usernameSelector),
    Saga.select(inSearchSelector),
  ])

  if (!inSearch) {
    return
  }

  const actionsToPut = [Saga.put(Creators.removeTempPendingConversations())]
  if (userInputItemIds.length) {
    actionsToPut.push(Saga.put(Creators.startConversation(userInputItemIds.concat(me), false, true)))
  } else {
    actionsToPut.push(Saga.put(Creators.selectConversation(null, false)))
    actionsToPut.push(Saga.put(SearchCreators.searchSuggestions('chatSearch')))
  }

  // Always clear the search results when you select/unselect
  actionsToPut.push(Saga.put(SearchCreators.clearSearchResults('chatSearch')))
  yield Saga.all(actionsToPut)
}

function* registerSagas(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeLatest(
    SearchConstants.isUserInputItemsUpdated('chatSearch'),
    _updateTempSearchConversation
  )
  yield Saga.safeTakeEveryPure('chat:exitSearch', _exitSearch, s => [
    SearchConstants.getUserInputItemIds(s, {searchKey: 'chatSearch'}),
    Selectors.previousConversationSelector(s),
  ])
  yield Saga.safeTakeEvery('chat:newChat', _newChat)
}

export {registerSagas}
