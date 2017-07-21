// @flow
import * as Constants from '../../constants/chat'
import * as SearchConstants from '../../constants/searchv3'
import * as Creators from '../../actions/chat/creators'
import Conversation from './index'
import NoConversation from './no-conversation'
import Rekey from './rekey/container'
import pausableConnect from '../../util/pausable-connect'
import {getProfile} from '../../actions/tracker'
import {withState, withHandlers, compose, branch, renderNothing, renderComponent} from 'recompose'
import {selectedSearchIdHoc} from '../../searchv3/helpers'
import {chatSearchResultArray} from '../../constants/selectors'
import ConversationError from './error/conversation-error'

import type {Props} from '.'
import type {TypedState} from '../../constants/reducer'

type StateProps = {|
  isActiveRoute: boolean,
  finalizeInfo: ?Constants.FinalizeInfo,
  rekeyInfo: ?Constants.RekeyInfo,
  selectedConversationIDKey: ?Constants.ConversationIDKey,
  showLoader: boolean,
  supersededBy: ?Constants.SupersedeInfo,
  supersedes: ?Constants.SupersedeInfo,
  threadLoadedOffline: boolean,
  inSearch: boolean,
  searchResultIds: Array<SearchConstants.SearchResultId>,
  showSearchResults: boolean,
  showSearchPending: boolean,
  showSearchSuggestions: boolean,
  conversationIsError: boolean,
  conversationErrorText: string,
|}

type DispatchProps = {|
  _onAttach: (
    conversationIDKey: Constants.ConversationIDKey,
    inputs: Array<Constants.AttachmentInput>
  ) => void,
  onOpenInfoPanelMobile: () => void,
  onExitSearch: () => void,
  onBack: () => void,
  _clearSearchResults: () => void,
  _onClickSearchResult: (id: string) => void,
  onShowTrackerInSearch: (id: string) => void,
|}

const mapStateToProps = (state: TypedState, {isActiveRoute, routePath, routeState}): StateProps => {
  const selectedConversationIDKey = routePath.last()
  let finalizeInfo = null
  let rekeyInfo = null
  let supersedes = null
  let supersededBy = null
  let showLoader = false
  let threadLoadedOffline = false
  let conversationIsError = false
  let conversationErrorText = ''

  if (selectedConversationIDKey !== Constants.nothingSelected) {
    rekeyInfo = state.chat.get('rekeyInfos').get(selectedConversationIDKey)
    finalizeInfo = state.chat.get('finalizedState').get(selectedConversationIDKey)
    supersedes = Constants.convSupersedesInfo(selectedConversationIDKey, state.chat)
    supersededBy = Constants.convSupersededByInfo(selectedConversationIDKey, state.chat)

    const conversationState = state.chat.get('conversationStates').get(selectedConversationIDKey)
    if (conversationState) {
      const inbox = state.chat.get('inbox')
      const selected =
        inbox && inbox.find(inbox => inbox.get('conversationIDKey') === selectedConversationIDKey)
      if (selected && selected.state === 'error') {
        conversationIsError = true
        conversationErrorText = selected.snippet
      }
      showLoader = !(selected && selected.state === 'unboxed') || conversationState.isRequesting
      threadLoadedOffline = conversationState.loadedOffline
    }
  }

  const {inSearch, searchPending, searchResults, searchShowingSuggestions} = state.chat
  return {
    isActiveRoute,
    conversationErrorText,
    conversationIsError,
    finalizeInfo,
    rekeyInfo,
    selectedConversationIDKey,
    showLoader,
    supersededBy,
    supersedes,
    threadLoadedOffline,
    inSearch,
    searchResultIds: chatSearchResultArray(state),
    showSearchPending: searchPending,
    showSearchResults: !!searchResults,
    showSearchSuggestions: searchShowingSuggestions,
  }
}

const mapDispatchToProps = (
  dispatch: Dispatch,
  {setRouteState, navigateUp, navigateAppend}
): DispatchProps => ({
  onExitSearch: () => dispatch(Creators.exitSearch()),
  _onAttach: (selectedConversation, inputs: Array<Constants.AttachmentInput>) => {
    dispatch(
      navigateAppend([
        {props: {conversationIDKey: selectedConversation, inputs}, selected: 'attachmentInput'},
      ])
    )
  },
  onOpenInfoPanelMobile: () => dispatch(navigateAppend(['infoPanel'])),
  onBack: () => dispatch(navigateUp()),
  _clearSearchResults: () => dispatch(Creators.clearSearchResults()),
  _onClickSearchResult: id => {
    dispatch(Creators.stageUserForSearch(id))
  },
  onShowTrackerInSearch: id => dispatch(getProfile(id, false, true)),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps) => {
  return {
    ...stateProps,
    ...dispatchProps,
    onAttach: (inputs: Array<Constants.AttachmentInput>) => {
      stateProps.selectedConversationIDKey &&
        dispatchProps._onAttach(stateProps.selectedConversationIDKey, inputs)
    },
  }
}

export default compose(
  pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps),
  branch((props: Props) => !props.selectedConversationIDKey, renderNothing),
  branch(
    (props: Props) => props.selectedConversationIDKey === Constants.nothingSelected && !props.inSearch,
    renderComponent(NoConversation)
  ),
  branch((props: Props) => props.conversationIsError, renderComponent(ConversationError)),
  branch((props: Props) => !props.finalizeInfo && props.rekeyInfo, renderComponent(Rekey)),
  withState('focusInputCounter', 'setFocusInputCounter', 0),
  withState('editLastMessageCounter', 'setEditLastMessageCounter', 0),
  withState('listScrollDownCounter', 'setListScrollDownCounter', 0),
  withState('searchText', 'onChangeSearchText', ''),
  withState('addNewParticipant', 'onAddNewParticipant', false),
  selectedSearchIdHoc,
  withHandlers({
    onAddNewParticipant: props => () => props.onAddNewParticipant(true),
    onEditLastMessage: props => () => props.setEditLastMessageCounter(props.editLastMessageCounter + 1),
    onFocusInput: props => () => props.setFocusInputCounter(props.focusInputCounter + 1),
    onScrollDown: props => () => props.setListScrollDownCounter(props.listScrollDownCounter + 1),
    onClickSearchResult: props => id => {
      props.onChangeSearchText('')
      props._onClickSearchResult(id)
      props._clearSearchResults()
    },
    onMouseOverSearchResult: props => id => {
      props.onUpdateSelectedSearchResult(id)
    },
  })
)(Conversation)
