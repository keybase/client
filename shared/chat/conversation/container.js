// @flow
import * as Constants from '../../constants/chat'
import * as SearchConstants from '../../constants/searchv3'
import * as Creators from '../../actions/chat/creators'
import * as SearchCreators from '../../actions/searchv3/creators'
import Conversation from './index'
import NoConversation from './no-conversation'
import Rekey from './rekey/container'
import {debounce} from 'lodash'
import {connect} from 'react-redux'
import {navigateAppend} from '../../actions/route-tree'
import {getProfile} from '../../actions/tracker'
import {hideKeyboard} from '../../actions/app'
import {withState, withHandlers, compose, branch, renderNothing, lifecycle, renderComponent} from 'recompose'

import type {Props} from '.'
import type {TypedState} from '../../constants/reducer'

type StateProps = {|
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
|}

type DispatchProps = {|
  _onAttach: (
    conversationIDKey: Constants.ConversationIDKey,
    inputs: Array<Constants.AttachmentInput>
  ) => void,
  _hideKeyboard: () => void,
  onBack: () => void,
  _search: (term: string, service: SearchConstants.Service) => void,
  _clearSearchResults: () => void,
  _onClickSearchResult: (id: string) => void,
  onShowTrackerInSearch: (id: string) => void,
|}

const mapStateToProps = (state: TypedState, {routePath, routeState}): StateProps => {
  const selectedConversationIDKey = routePath.last()
  let finalizeInfo = null
  let rekeyInfo = null
  let supersedes = null
  let supersededBy = null
  let showLoader = false
  let threadLoadedOffline = false

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
      showLoader = !(selected && selected.state === 'unboxed') || conversationState.isRequesting
      threadLoadedOffline = conversationState.loadedOffline
    }
  }

  const searchResults = state.chat.searchResults

  return {
    finalizeInfo,
    rekeyInfo,
    selectedConversationIDKey,
    showLoader,
    supersededBy,
    supersedes,
    threadLoadedOffline,
    inSearch: state.chat.inSearch,
    searchResultIds: searchResults ? searchResults.toArray() : [],
    showSearchResults: !!searchResults,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {setRouteState, navigateUp}): DispatchProps => ({
  _onAttach: (selectedConversation, inputs: Array<Constants.AttachmentInput>) => {
    dispatch(
      navigateAppend([
        {props: {conversationIDKey: selectedConversation, inputs}, selected: 'attachmentInput'},
      ])
    )
  },
  _hideKeyboard: () => dispatch(hideKeyboard()),
  onBack: () => dispatch(navigateUp()),
  _search: debounce(
    (term: string, service) => dispatch(SearchCreators.search(term, 'chat:updateSearchResults', service)),
    1e3
  ),
  _clearSearchResults: () => dispatch(Creators.clearSearchResults()),
  _onClickSearchResult: id => {
    dispatch(Creators.stageUserForSearch(id))
    dispatch(Creators.clearSearchResults(id))
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
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  branch((props: Props) => !props.selectedConversationIDKey, renderNothing),
  branch(
    (props: Props) => props.selectedConversationIDKey === Constants.nothingSelected && !props.inSearch,
    renderComponent(NoConversation)
  ),
  branch((props: Props) => !props.finalizeInfo && props.rekeyInfo, renderComponent(Rekey)),
  withState('sidePanelOpen', 'setSidePanelOpen', false),
  withState('focusInputCounter', 'setFocusInputCounter', 0),
  withState('editLastMessageCounter', 'setEditLastMessageCounter', 0),
  withState('listScrollDownCounter', 'setListScrollDownCounter', 0),
  withState('searchText', 'onChangeSearchText', ''),
  withHandlers({
    onCloseSidePanel: props => () => props.setSidePanelOpen(false),
    onEditLastMessage: props => () => props.setEditLastMessageCounter(props.editLastMessageCounter + 1),
    onFocusInput: props => () => props.setFocusInputCounter(props.focusInputCounter + 1),
    onScrollDown: props => () => props.setListScrollDownCounter(props.listScrollDownCounter + 1),
    onToggleSidePanel: props => () => {
      !props.sidePanelOpen && props._hideKeyboard()
      props.setSidePanelOpen(!props.sidePanelOpen)
    },
    search: props => (term, service) => {
      if (term) {
        props._search(term, service)
      } else {
        props._clearSearchResults()
      }
    },
    onClickSearchResult: props => id => {
      props.onChangeSearchText('')
      props._onClickSearchResult(id)
      props._clearSearchResults()
    },
  }),
  lifecycle({
    componentWillReceiveProps: function(nextProps: Props) {
      if (this.props.selectedConversationIDKey !== nextProps.selectedConversationIDKey) {
        this.props.onCloseSidePanel()
      }
    },
  })
)(Conversation)
