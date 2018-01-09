// @flow
import * as Constants from '../../../constants/chat2'
import * as Types from '../../../constants/types/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
// import * as RouteTree from '../../../actions/route-tree'
import HiddenString from '../../../util/hidden-string'
import Input from '.'
import ChannelPreview from './channel-preview'
import {getPathState} from '../../../route-tree'
import {
  branch,
  compose,
  renderComponent,
  renderNothing,
  withHandlers,
  withState,
  lifecycle,
  connect,
} from '../../../util/container'
// import throttle from 'lodash/throttle'
import {chatTab} from '../../../constants/tabs'
import type {TypedState, Dispatch} from '../../../util/container'
import {type OwnProps} from './container'

const mapStateToProps = (state: TypedState) => {
  const _selectedConversationIDKey = Constants.getSelectedConversation(state)
  const routeState = getPathState(state.routeTree.routeState, [chatTab, _selectedConversationIDKey || ''])
  const editingOrdinal = Constants.getEditingOrdinal(state, _selectedConversationIDKey || '')

  return {
    _defaultText: (routeState && routeState.get('inputText', new HiddenString('')).stringValue()) || '',
    _editingMessage: editingOrdinal
      ? Constants.getMessageMap(state, _selectedConversationIDKey).get(editingOrdinal)
      : null,
    _meta: Constants.getMeta(state),
    _selectedConversationIDKey,
    typing: Constants.getTyping(state, _selectedConversationIDKey || ''),
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  // onAttach: (selectedConversation, inputs: Array<any [> Types.AttachmentInput <]>) =>
  // dispatch(
  // RouteTree.navigateAppend([
  // {props: {conversationIDKey: selectedConversation, inputs}, selected: 'attachmentInput'},
  // ])
  // ),
  _onEditMessage: (message: Types.Message, body: string) =>
    dispatch(
      Chat2Gen.createMessageEdit({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.ordinal,
        text: new HiddenString(body),
      })
    ),
  _onPostMessage: (selectedConversation: Types.ConversationIDKey, text: string) =>
    dispatch(
      Chat2Gen.createMessageSend({conversationIDKey: selectedConversation, text: new HiddenString(text)})
    ),
  // onShowEditor: (message: Types.Message) => {
  // TODO
  // dispatch(ChatGen.createShowEditor({message}))
  // },
  _onStoreInputText: (selectedConversation: Types.ConversationIDKey, inputText: string) => {
    // dispatch(Creators.setSelectedRouteState(selectedConversation, {inputText: new HiddenString(inputText)})),
  },
  _onUpdateTyping: (selectedConversation: Types.ConversationIDKey, typing: boolean) => {
    // dispatch(ChatGen.createUpdateTyping({conversationIDKey: selectedConversation, typing})),
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  // const updateTyping = (typing: boolean) => {
  // if (stateProps.selectedConversationIDKey) {
  // dispatchProps.onUpdateTyping(stateProps.selectedConversationIDKey, typing)
  // }
  // }
  // const wrappedTyping = throttle(updateTyping, 5000)

  return {
    // ...stateProps,
    // ...dispatchProps,
    // ...ownProps,
    isEditing: !!stateProps._editingMessage,
    channelName: stateProps._meta.channelname,
    focusInputCounter: ownProps.focusInputCounter,
    hasResetUsers: !stateProps._meta.resetParticipants.isEmpty(),
    isLoading: false,
    // isPreview: false, // TODO
    teamname: stateProps._meta.teamname,
    // typing: [], // TODO
    // onAttach: (inputs: Array<any [> Types.AttachmentInput <]>) =>
    // dispatchProps.onAttach(stateProps.selectedConversationIDKey, inputs),
    // onEditLastMessage: ownProps.onEditLastMessage,
    onPostMessage: (text: string) => {
      if (stateProps._editingMessage) {
        dispatchProps._onEditMessage(stateProps._editingMessage, text)
      } else {
        dispatchProps._onPostMessage(stateProps._selectedConversationIDKey, text)
      }
      ownProps.onScrollDown()
    },
    onStoreInputText: (inputText: string) => {
      if (stateProps._selectedConversationIDKey) {
        // only write if we're in a convo
        dispatchProps._onStoreInputText(stateProps._selectedConversationIDKey, inputText)
      }
    },
    onUpdateTyping: (typing: boolean) => {
      // if (!typing) {
      // // Update the not-typing status immediately, even if we're throttled.
      // wrappedTyping.cancel()
      // updateTyping(typing)
      // } else {
      // wrappedTyping(typing)
      // }
    },
    onJoinChannel: () => dispatchProps.onJoinChannel(stateProps._selectedConversationIDKey),
    onLeaveChannel: () => {
      dispatchProps.onLeaveChannel(stateProps._selectedConversationIDKey, stateProps._meta.teamname)
    },
  }
}

const ConnectedInput = compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  withState('text', '_setText', props => props._defaultText || ''),
  withState('mentionPopupOpen', 'setMentionPopupOpen', false),
  withState('mentionFilter', 'setMentionFilter', ''),
  withHandlers(props => {
    let input
    // mutable value to store the latest text synchronously
    let _syncTextValue = ''
    return {
      // inputClear: props => () => {
      // input && input.setNativeProps({text: ''})
      // },
      inputFocus: props => () => input && input.focus(),
      inputBlur: props => () => input && input.blur(),
      inputSelections: props => () => (input && input.selections()) || {},
      inputSetRef: props => i => {
        input = i
      },
      setText: props => (nextText: string) => {
        _syncTextValue = nextText
        return props._setText(nextText)
      },
      inputValue: props => () => _syncTextValue || '',
    }
  }),
  lifecycle({
    componentDidUpdate: function(prevProps) {
      if (this.props.focusInputCounter !== prevProps.focusInputCounter) {
        this.props.inputFocus()
      }
    },
    componentWillUnmount: function() {
      this.props.onStoreInputText(this.props.text)
    },
    componentWillReceiveProps: function(nextProps) {
      if (
        this.props._selectedConversationIDKey &&
        this.props._selectedConversationIDKey !== nextProps._selectedConversationIDKey
      ) {
        this.props.onStoreInputText(this.props.text)
        // withState won't get called again if props changes!
        this.props.setText(nextProps._defaultText)
      }
    },
  })
)(Input)

const mapStateToPropsPreview = (state: TypedState) => {
  const _selectedConversationIDKey = Constants.getSelectedConversation(state)
  const _meta = Constants.getMeta(state, _selectedConversationIDKey)
  return {
    _meta,
    _selectedConversationIDKey,
  }
}
const mapDispatchToPropsPreview = (dispatch: Dispatch, ownProps: OwnProps) => ({
  _onJoinChannel: (selectedConversation: Types.ConversationIDKey) => {
    // dispatch(ChatGen.createJoinConversation({conversationIDKey: selectedConversation})),
  },
  _onLeaveChannel: (selectedConversation: Types.ConversationIDKey, teamname: string) => {
    // dispatch(ChatGen.createLeaveConversation({conversationIDKey: selectedConversation}))
    // dispatch(RouteTree.navigateUp())
    // if (ownProps.previousPath) {
    // dispatch(RouteTree.navigateTo(ownProps.previousPath))
    // }
  },
})
const mergePropsPreview = (stateProps, dispatchProps, ownProps) => ({
  channelname: stateProps._meta.channelname,
  onJoinChannel: () => dispatchProps._onJoinChannel(stateProps._selectedConversationIDKey),
  onLeaveChannel: () =>
    dispatchProps._onLeaveChannel(stateProps._selectedConversationIDKey, stateProps._meta.teamname),
})

const ConnectedChannelPreview = connect(mapStateToPropsPreview, mapDispatchToPropsPreview, mergePropsPreview)(
  ChannelPreview
)

const mapStateToPropsChooser = (state: TypedState) => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state)
  const meta = Constants.getMeta(state, selectedConversationIDKey)
  return {
    hasResetUsers: !meta.resetParticipants.isEmpty(),
    isPreview: false, // TODO
  }
}

export default compose(
  connect(mapStateToPropsChooser, () => ({})),
  branch(props => props.hasResetUsers, renderNothing),
  branch(props => props.isPreview, renderComponent(ConnectedChannelPreview))
)(ConnectedInput)
