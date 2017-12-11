// @flow
import * as ChatGen from '../chat-gen'
import * as Constants from '../../constants/chat'
import * as Selectors from '../../constants/selectors'
import * as SearchConstants from '../../constants/search'
import * as SearchGen from '../search-gen'
import * as Saga from '../../util/saga'
import type {ReturnValue} from '../../constants/types/more'
import type {TypedState} from '../../constants/reducer'

function _newChat(action: ChatGen.NewChatPayload, state: TypedState) {
  const actions = []
  actions.push(Saga.put(ChatGen.createSetInboxFilter({filter: ''})))
  const ids = SearchConstants.getUserInputItemIds(state, {searchKey: 'chatSearch'})
  // Ignore 'New Chat' attempts when we're already building a chat
  if (!ids || !ids.length) {
    actions.push(
      Saga.put(
        ChatGen.createSetPreviousConversation({
          conversationIDKey: Constants.getSelectedConversation(state),
        })
      )
    )
    actions.push(Saga.put(ChatGen.createSelectConversation({conversationIDKey: null})))
    actions.push(Saga.put(SearchGen.createSearchSuggestions({searchKey: 'chatSearch'})))
  }

  return Saga.sequentially(actions)
}

function _exitSearch({payload: {skipSelectPreviousConversation}}: ChatGen.ExitSearchPayload, s: TypedState) {
  const userInputItemIds: ReturnValue<
    typeof SearchConstants.getUserInputItemIds
  > = SearchConstants.getUserInputItemIds(s, {searchKey: 'chatSearch'})
  const previousConversation: ReturnValue<
    typeof Selectors.previousConversationSelector
  > = Selectors.previousConversationSelector(s)

  return Saga.sequentially(
    [
      Saga.put(SearchGen.createClearSearchResults({searchKey: 'chatSearch'})),
      Saga.put(SearchGen.createSetUserInputItems({searchKey: 'chatSearch', searchResults: []})),
      Saga.put(ChatGen.createRemoveTempPendingConversations()),
      userInputItemIds.length === 0 && !skipSelectPreviousConversation
        ? Saga.put(ChatGen.createSelectConversation({conversationIDKey: previousConversation}))
        : null,
    ].filter(Boolean)
  )
}

// TODO this is kinda confusing. I think there is duplicated state...
function* _updateTempSearchConversation(action: SearchGen.UserInputItemsUpdatedPayload) {
  const {payload: {userInputItemIds}} = action
  const state: TypedState = yield Saga.select()
  const me = Selectors.usernameSelector(state)
  const inSearch = state.chat.get('inSearch')

  if (!inSearch || !me) {
    return
  }

  const actionsToPut = [Saga.put(ChatGen.createRemoveTempPendingConversations())]
  if (userInputItemIds.length) {
    actionsToPut.push(
      Saga.put(
        ChatGen.createStartConversation({
          users: userInputItemIds.concat(me),
          temporary: true,
          forSearch: true,
        })
      )
    )
  } else {
    actionsToPut.push(Saga.put(ChatGen.createSelectConversation({conversationIDKey: null, fromUser: false})))
    actionsToPut.push(Saga.put(SearchGen.createSearchSuggestions({searchKey: 'chatSearch'})))
  }

  // Always clear the search results when you select/unselect
  actionsToPut.push(Saga.put(SearchGen.createClearSearchResults({searchKey: 'chatSearch'})))
  yield Saga.sequentially(actionsToPut)
}

function* registerSagas(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeLatest(
    SearchConstants.isUserInputItemsUpdated('chatSearch'),
    _updateTempSearchConversation
  )
  yield Saga.safeTakeEveryPure(ChatGen.exitSearch, _exitSearch)
  yield Saga.safeTakeEveryPure(ChatGen.newChat, _newChat)
}

export {registerSagas}
