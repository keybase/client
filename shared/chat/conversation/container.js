// @flow
import * as Constants from '../../constants/chat'
import * as Types from '../../constants/types/chat'
import * as SearchConstants from '../../constants/search'
import * as Creators from '../../actions/chat/creators'
import * as ChatGen from '../../actions/chat-gen'
import {type List} from 'immutable'
import HiddenString from '../../util/hidden-string'
import Conversation from './index'
import NoConversation from './no-conversation'
import Rekey from './rekey/container'
import {getProfile} from '../../actions/tracker'
import {
  pausableConnect,
  withState,
  withHandlers,
  compose,
  branch,
  renderComponent,
  type TypedState,
} from '../../util/container'
import ConversationError from './error/conversation-error'
import {type Props} from '.'
import flags from '../../util/feature-flags'

type StateProps = {|
  finalizeInfo: ?Types.FinalizeInfo,
  rekeyInfo: ?Types.RekeyInfo,
  selectedConversationIDKey: ?Types.ConversationIDKey,
  showLoader: boolean,
  supersededBy: ?Types.SupersedeInfo,
  supersedes: ?Types.SupersedeInfo,
  threadLoadedOffline: boolean,
  inSearch: boolean,
  conversationIsError: boolean,
  conversationErrorText: string,
  defaultChatText: string,
  showTeamOffer: boolean,
  inboxFilter: ?string,
  showSearchResults: boolean,
  previousPath: ?List<string>,
|}

type DispatchProps = {|
  _onAttach: (conversationIDKey: Types.ConversationIDKey, inputs: Array<Types.AttachmentInput>) => void,
  onOpenInfoPanelMobile: () => void,
  onExitSearch: () => void,
  onBack: () => void,
  _onStoreInputText: (selectedConversation: Types.ConversationIDKey, inputText: string) => void,
  onShowTrackerInSearch: (id: string) => void,
|}

const mapStateToProps = (state: TypedState, {routePath, routeProps}): StateProps => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state)
  const routeState = Constants.getSelectedRouteState(state)

  let finalizeInfo = null
  let rekeyInfo = null
  let supersedes = null
  let supersededBy = null
  let showLoader = false
  let threadLoadedOffline = false
  let conversationIsError = false
  let conversationErrorText = ''
  const defaultChatText =
    (routeState && routeState.get('inputText', new HiddenString('')).stringValue()) || ''

  if (selectedConversationIDKey !== Constants.nothingSelected && !!selectedConversationIDKey) {
    rekeyInfo = state.chat.get('rekeyInfos').get(selectedConversationIDKey)
    finalizeInfo = state.chat.get('finalizedState').get(selectedConversationIDKey)
    supersedes = Constants.convSupersedesInfo(selectedConversationIDKey, state.chat)
    supersededBy = Constants.convSupersededByInfo(selectedConversationIDKey, state.chat)

    const conversationState = state.chat.get('conversationStates').get(selectedConversationIDKey)
    const untrustedState = state.chat.inboxUntrustedState.get(selectedConversationIDKey)
    if (conversationState) {
      const selected = Constants.getInbox(state, selectedConversationIDKey)
      if (selected && untrustedState === 'error') {
        conversationIsError = true
        conversationErrorText = Constants.getSnippet(state, selectedConversationIDKey)
      }
      showLoader =
        (!Constants.isPendingConversationIDKey(selectedConversationIDKey) && untrustedState !== 'unboxed') ||
        conversationState.isRequesting
      threadLoadedOffline = conversationState.loadedOffline
    }
  }

  const {inSearch, inboxFilter} = state.chat
  const searchResults = SearchConstants.getSearchResultIdsArray(state, {searchKey: 'chatSearch'})
  const userInputItemIds = SearchConstants.getUserInputItemIds(state, {searchKey: 'chatSearch'})

  // If it's a multi-user chat that isn't a team, offer to make a new team.
  const showTeamOffer = flags.teamChatEnabled && inSearch && userInputItemIds && userInputItemIds.length > 1

  return {
    showSearchResults: inSearch && !!searchResults,
    conversationErrorText,
    conversationIsError,
    finalizeInfo,
    inboxFilter,
    rekeyInfo,
    selectedConversationIDKey,
    showLoader,
    supersededBy,
    supersedes,
    threadLoadedOffline,
    inSearch,
    defaultChatText,
    showTeamOffer,
    previousPath: routeProps.get('previousPath'),
  }
}

const mapDispatchToProps = (
  dispatch: Dispatch,
  {setRouteState, navigateUp, navigateAppend}
): DispatchProps => ({
  onExitSearch: () => dispatch(ChatGen.createExitSearch({skipSelectPreviousConversation: false})),
  _onAttach: (selectedConversation, inputs: Array<Types.AttachmentInput>) => {
    dispatch(
      navigateAppend([
        {props: {conversationIDKey: selectedConversation, inputs}, selected: 'attachmentInput'},
      ])
    )
  },
  onOpenInfoPanelMobile: () => dispatch(navigateAppend(['infoPanel'])),
  onBack: () => dispatch(navigateUp()),
  onShowTrackerInSearch: id => dispatch(getProfile(id, false, true)),
  _onStoreInputText: (selectedConversation: Types.ConversationIDKey, inputText: string) =>
    dispatch(Creators.setSelectedRouteState(selectedConversation, {inputText: new HiddenString(inputText)})),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps) => {
  return {
    ...stateProps,
    ...dispatchProps,
    onStoreInputText: (chatText: string) => {
      if (stateProps.selectedConversationIDKey) {
        // only write if we're in a convo
        dispatchProps._onStoreInputText(stateProps.selectedConversationIDKey, chatText)
      }
    },
    onAttach: (inputs: Array<Types.AttachmentInput>) => {
      stateProps.selectedConversationIDKey &&
        dispatchProps._onAttach(stateProps.selectedConversationIDKey, inputs)
    },
  }
}

export default compose(
  pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps),
  branch(
    (props: Props) =>
      (props.selectedConversationIDKey === Constants.nothingSelected || !props.selectedConversationIDKey) &&
      !props.inSearch,
    // $FlowIssue gets very confused here
    renderComponent(NoConversation)
  ),
  // Ordering of branch() is important here -- rekey should come before error.
  branch((props: Props) => !props.finalizeInfo && !!props.rekeyInfo, renderComponent(Rekey)),
  branch((props: Props) => props.conversationIsError, renderComponent(ConversationError)),
  withState('focusInputCounter', 'setFocusInputCounter', 0),
  withState('editLastMessageCounter', 'setEditLastMessageCounter', 0),
  withState('listScrollDownCounter', 'setListScrollDownCounter', 0),
  withHandlers({
    onAddNewParticipant: props => () => props.onAddNewParticipant(true),
    onEditLastMessage: props => () => props.setEditLastMessageCounter(props.editLastMessageCounter + 1),
    onFocusInput: props => () => props.setFocusInputCounter(props.focusInputCounter + 1),
    onScrollDown: props => () => props.setListScrollDownCounter(props.listScrollDownCounter + 1),
  })
)(Conversation)
