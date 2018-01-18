// @flow
// import * as React from 'react'
import * as TrackerGen from '../../../actions/tracker-gen'
import * as Constants from '../../../constants/chat2'
// import * as Types from '../../constants/types/chat2'
// import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
// import * as SearchConstants from '../../constants/search'
// import * as Chat2Gen from '../../actions/chat2-gen'
// import {type List} from 'immutable'
// import HiddenString from '../../util/hidden-string'
import Normal from '.'
// import NoConversation from './no-conversation'
// import Rekey from './rekey/container'
import {
  compose,
  connect,
  withStateHandlers,
  type TypedState,
  // type Dispatch,
} from '../../../util/container'
// import ConversationError from './error/conversation-error'
// import {type Props} from '.'
// import flags from '../../util/feature-flags'

// type StateProps = {|
// finalizeInfo: ?Types.FinalizeInfo,
// rekeyInfo: ?Types.RekeyInfo,
// selectedConversationIDKey: ?Types.ConversationIDKey,
// showLoader: boolean,
// supersededBy: any, // ?Types.SupersedeInfo,
// supersedes: any, // ?Types.SupersedeInfo,
// threadLoadedOffline: boolean,
// inSearch: boolean,
// conversationIsError: boolean,
// conversationErrorText: string,
// defaultChatText: string,
// showTeamOffer: boolean,
// inboxFilter: ?string,
// showSearchResults: boolean,
// previousPath: ?List<string>,
// youAreReset: boolean,
// |}

// type DispatchProps = {|
// _onAttach: (conversationIDKey: Types.ConversationIDKey, inputs: Array<Types.AttachmentInput>) => void,
// onOpenInfoPanelMobile: () => void,
// onExitSearch: () => void,
// onBack: () => void,
// // _onStoreInputText: (selectedConversation: Types.ConversationIDKey, inputText: string) => void,
// onShowTrackerInSearch: (id: string) => void,
// |}

const mapStateToProps = (state: TypedState, {routePath, routeProps}) => {
  const conversationIDKey = Constants.getSelectedConversation(state)
  return {conversationIDKey}
  // const routeState = Constants.getSelectedRouteState(state)

  // let finalizeInfo = null
  // let rekeyInfo = null
  // let supersedes = null
  // let supersededBy = null
  // let showLoader = false
  // let threadLoadedOffline = false
  // let conversationIsError = false
  // let conversationErrorText = ''
  // let youAreReset = false
  // const defaultChatText =
  // (routeState && routeState.get('inputText', new HiddenString('')).stringValue()) || ''

  // if (selectedConversationIDKey !== Constants.nothingSelected && !!selectedConversationIDKey) {
  // rekeyInfo = null // state.chat.get('rekeyInfos').get(selectedConversationIDKey)
  // finalizeInfo = null // state.chat.get('finalizedState').get(selectedConversationIDKey)
  // supersedes = null // TODO Constants.convSupersedesInfo(selectedConversationIDKey, state.chat)
  // supersededBy = null // TODO Constants.convSupersededByInfo(selectedConversationIDKey, state.chat)
  // youAreReset =
  // state.chat.getIn(
  // ['inbox', selectedConversationIDKey, 'memberStatus'],
  // RPCChatTypes.commonConversationMemberStatus.active
  // ) === RPCChatTypes.commonConversationMemberStatus.reset

  // const conversationState = state.chat.get('conversationStates').get(selectedConversationIDKey)
  // const untrustedState = null // TODO state.chat.inboxUntrustedState.get(selectedConversationIDKey)
  // if (conversationState) {
  // const selected = Constants.getInbox(state, selectedConversationIDKey)
  // if (selected && untrustedState === 'error') {
  // conversationIsError = true
  // // TODO
  // // conversationErrorText = Constants.getSnippet(state, selectedConversationIDKey)
  // }
  // showLoader =
  // (!Constants.isPendingConversationIDKey(selectedConversationIDKey) && untrustedState !== 'unboxed') ||
  // conversationState.isRequesting
  // threadLoadedOffline = conversationState.loadedOffline
  // }
  // }

  // const {inboxFilter, isSearching: inSearch} = state.chat2
  // const searchResults = SearchConstants.getSearchResultIdsArray(state, {searchKey: 'chatSearch'})
  // const userInputItemIds = SearchConstants.getUserInputItemIds(state, {searchKey: 'chatSearch'})

  // // If it's a multi-user chat that isn't a team, offer to make a new team.
  // const showTeamOffer =  inSearch && userInputItemIds && userInputItemIds.length > 1

  // return {
  // showSearchResults: inSearch && !!searchResults,
  // conversationErrorText,
  // conversationIsError,
  // finalizeInfo,
  // inboxFilter,
  // rekeyInfo,
  // selectedConversationIDKey,
  // showLoader,
  // supersededBy,
  // supersedes,
  // threadLoadedOffline,
  // inSearch,
  // defaultChatText,
  // showTeamOffer,
  // previousPath: routeProps.get('previousPath'),
  // youAreReset,
  // }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  // }), {setRouteState, navigateUp, navigateAppend}) => ({
  // onExitSearch: () => dispatch(Chat2Gen.createSetSearching({searching: false})),
  // _onAttach: (selectedConversation, inputs: Array<Types.AttachmentInput>) => {
  // dispatch(
  // navigateAppend([
  // {props: {conversationIDKey: selectedConversation, inputs}, selected: 'attachmentInput'},
  // ])
  // )
  // },
  // onOpenInfoPanelMobile: () => dispatch(navigateAppend(['infoPanel'])),
  // onBack: () => dispatch(navigateUp()),
  onShowTracker: (username: string) =>
    dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: false, username})),
})

const mergeProps = (stateProps, dispatchProps) => {
  return {
    conversationIDKey: stateProps.conversationIDKey,
    onShowTracker: dispatchProps.onShowTracker,
  }
  // return {
  // ...stateProps,
  // ...dispatchProps,
  // // onStoreInputText: (chatText: string) => {
  // // if (stateProps.selectedConversationIDKey) {
  // // // only write if we're in a convo
  // // dispatchProps._onStoreInputText(stateProps.selectedConversationIDKey, chatText)
  // // }
  // // },
  // onAttach: (inputs: Array<Types.AttachmentInput>) => {
  // stateProps.selectedConversationIDKey &&
  // dispatchProps._onAttach(stateProps.selectedConversationIDKey, inputs)
  // },
  // }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  withStateHandlers(
    {focusInputCounter: 0, listScrollDownCounter: 0},
    {
      onFocusInput: ({focusInputCounter}) => () => ({focusInputCounter: focusInputCounter + 1}),
      onScrollDown: ({listScrollDownCounter}) => () => ({listScrollDownCounter: listScrollDownCounter + 1}),
    }
  )
)(Normal)
// connect(mapStateToPropsConversation, mapDispatchToPropsConversation, mergePropsConversation),
// withHandlers({
// // onAddNewParticipant: props => () => props.onAddNewParticipant(true),
// })
