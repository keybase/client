// @flow
import * as Creators from './creators'
import * as ChatGen from '../chat-gen'
import * as Constants from '../../constants/chat'
import * as Selectors from '../../constants/selectors'
import * as SearchConstants from '../../constants/search'
import * as SearchCreators from '../search/creators'
import * as Saga from '../../util/saga'
import type {ReturnValue} from '../../constants/types/more'
import type {TypedState} from '../../constants/reducer'

const inSearchSelector = (state: TypedState) => state.chat.get('inSearch')

function* _newChat(action: ChatGen.NewChatPayload): Saga.SagaGenerator<any, any> {
  yield Saga.put(ChatGen.createSetInboxFilter({filter: ''}))
  const ids = yield Saga.select(SearchConstants.getUserInputItemIds, {searchKey: 'chatSearch'})
  if (ids && !!ids.length) {
    // Ignore 'New Chat' attempts when we're already building a chat
    return
  }
  yield Saga.put(
    ChatGen.createSetPreviousConversation({
      conversationIDKey: yield Saga.select(Constants.getSelectedConversation),
    })
  )
  yield Saga.put(ChatGen.createSelectConversation({conversationIDKey: null}))
  yield Saga.put(SearchCreators.searchSuggestions('chatSearch'))
}

function _exitSearch({payload: {skipSelectPreviousConversation}}: ChatGen.ExitSearchPayload, s: TypedState) {
  const userInputItemIds: ReturnValue<
    typeof SearchConstants.getUserInputItemIds
  > = SearchConstants.getUserInputItemIds(s, {searchKey: 'chatSearch'})
  const previousConversation: ReturnValue<
    typeof Selectors.previousConversationSelector
  > = Selectors.previousConversationSelector(s)

  return Saga.all(
    [
      Saga.put(SearchCreators.clearSearchResults('chatSearch')),
      Saga.put(SearchCreators.setUserInputItems('chatSearch', [])),
      Saga.put(ChatGen.createRemoveTempPendingConversations()),
      userInputItemIds.length === 0 && !skipSelectPreviousConversation
        ? Saga.put(ChatGen.createSelectConversation({conversationIDKey: previousConversation}))
        : null,
    ].filter(Boolean)
  )
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

  const actionsToPut = [Saga.put(ChatGen.createRemoveTempPendingConversations())]
  if (userInputItemIds.length) {
    actionsToPut.push(
      Saga.put(ChatGen.createStartConversation({users: userInputItemIds.concat(me), temporary: true}))
    )
  } else {
    actionsToPut.push(Saga.put(ChatGen.createSelectConversation({conversationIDKey: null, fromUser: false})))
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
  yield Saga.safeTakeEveryPure(ChatGen.exitSearch, _exitSearch)
  yield Saga.safeTakeEvery(ChatGen.newChat, _newChat)
}

export {registerSagas}
