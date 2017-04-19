// @flow
import * as Constants from '../../constants/chat'
import Conversation from './index'
import NoConversation from './no-conversation'
import Rekey from './rekey/container'
import {connect} from 'react-redux'
import {navigateAppend} from '../../actions/route-tree'
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
|}

type DispatchProps = {|
  _onAttach: (conversationIDKey: Constants.ConversationIDKey, inputs: Array<Constants.AttachmentInput>) => void,
  onBack: () => void,
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
      const selected = inbox && inbox.find(inbox => inbox.get('conversationIDKey') === selectedConversationIDKey)
      showLoader = !(selected && selected.state === 'unboxed') || conversationState.isRequesting
      threadLoadedOffline = conversationState.loadedOffline
    }
  }

  return {
    finalizeInfo,
    rekeyInfo,
    selectedConversationIDKey,
    showLoader,
    supersededBy,
    supersedes,
    threadLoadedOffline,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {setRouteState, navigateUp}): DispatchProps => ({
  _onAttach: (selectedConversation, inputs: Array<Constants.AttachmentInput>) => { dispatch(navigateAppend([{props: {conversationIDKey: selectedConversation, inputs}, selected: 'attachmentInput'}])) },
  onBack: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps) => {
  return {
    ...stateProps,
    ...dispatchProps,
    onAttach: (inputs: Array<Constants.AttachmentInput>) => { stateProps.selectedConversationIDKey && dispatchProps._onAttach(stateProps.selectedConversationIDKey, inputs) },
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  branch((props: Props) => !props.selectedConversationIDKey, renderNothing()),
  branch((props: Props) => props.selectedConversationIDKey === Constants.nothingSelected, renderComponent(NoConversation)),
  branch((props: Props) => !props.finalizeInfo && props.rekeyInfo, renderComponent(Rekey)),
  withState('sidePanelOpen', 'setSidePanelOpen', false),
  withState('focusInputCounter', 'setFocusInputCounter', 0),
  withState('editLastMessageCounter', 'setEditLastMessageCounter', 0),
  withState('listScrollDownCounter', 'setListScrollDownCounter', 0),
  withHandlers({
    onCloseSidePanel: props => () => props.setSidePanelOpen(false),
    onEditLastMessage: props => () => props.setEditLastMessageCounter(props.editLastMessageCounter + 1),
    onFocusInput: props => () => props.setFocusInputCounter(props.focusInputCounter + 1),
    onScrollDown: props => () => props.setListScrollDownCounter(props.listScrollDownCounter + 1),
    onToggleSidePanel: props => () => props.setSidePanelOpen(!props.sidePanelOpen),
  }),
  lifecycle({
    componentWillReceiveProps: function (nextProps: Props) {
      if (this.props.selectedConversationIDKey !== nextProps.selectedConversationIDKey) {
        this.props.onCloseSidePanel()
      }
    },
  }),
)(Conversation)
