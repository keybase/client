// @flow
import * as Constants from '../../../constants/chat2'
import * as Types from '../../../constants/types/chat2'
import * as Creators from '../../../actions/chat/creators'
import * as ChatGen from '../../../actions/chat-gen'
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
import throttle from 'lodash/throttle'
import type {TypedState} from '../../../util/container'
import {chatTab} from '../../../constants/tabs'
import {navigateAppend, navigateUp, navigateTo} from '../../../actions/route-tree'
import {type OwnProps} from './container'

const mapStateToProps = (state: TypedState, ownProps: any) => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state)
  const routeState = getPathState(state.routeTree.routeState, [chatTab, selectedConversationIDKey || ''])

  return {
    _meta: Constants.getMeta(state),
    defaultText: (routeState && routeState.get('inputText', new HiddenString('')).stringValue()) || '',
    selectedConversationIDKey,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  onAttach: (selectedConversation, inputs: Array<any /* Types.AttachmentInput */>) =>
    dispatch(
      navigateAppend([
        {props: {conversationIDKey: selectedConversation, inputs}, selected: 'attachmentInput'},
      ])
    ),
  onEditMessage: (message: Types.Message, body: string) => {
    // TODO
    // dispatch(ChatGen.createEditMessage({message, text: new HiddenString(body)}))
  },
  onPostMessage: (selectedConversation, text) =>
    selectedConversation &&
    dispatch(
      ChatGen.createPostMessage({conversationIDKey: selectedConversation, text: new HiddenString(text)})
    ),
  onShowEditor: (message: Types.Message) => {
    // TODO
    // dispatch(ChatGen.createShowEditor({message}))
  },
  onStoreInputText: (selectedConversation: Types.ConversationIDKey, inputText: string) =>
    dispatch(Creators.setSelectedRouteState(selectedConversation, {inputText: new HiddenString(inputText)})),
  onUpdateTyping: (selectedConversation: Types.ConversationIDKey, typing: boolean) =>
    dispatch(ChatGen.createUpdateTyping({conversationIDKey: selectedConversation, typing})),
  onJoinChannel: (selectedConversation: Types.ConversationIDKey) =>
    dispatch(ChatGen.createJoinConversation({conversationIDKey: selectedConversation})),
  onLeaveChannel: (selectedConversation: Types.ConversationIDKey, teamname: string) => {
    dispatch(ChatGen.createLeaveConversation({conversationIDKey: selectedConversation}))
    dispatch(navigateUp())
    if (ownProps.previousPath) {
      dispatch(navigateTo(ownProps.previousPath))
    }
  },
})

// TODO type-recompose: fix when recompose types properly
const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const updateTyping = (typing: boolean) => {
    if (stateProps.selectedConversationIDKey) {
      dispatchProps.onUpdateTyping(stateProps.selectedConversationIDKey, typing)
    }
  }
  const wrappedTyping = throttle(updateTyping, 5000)

  return {
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    channelName: stateProps._meta.channelname,
    focusInputCounter: ownProps.focusInputCounter,
    hasResetUsers: !stateProps._meta.resetParticipants.isEmpty(),
    isLoading: false,
    isPreview: false, // TODO
    teamname: stateProps._meta.teamname,
    typing: [], // TODO
    onAttach: (inputs: Array<any /* Types.AttachmentInput */>) =>
      dispatchProps.onAttach(stateProps.selectedConversationIDKey, inputs),
    onEditLastMessage: ownProps.onEditLastMessage,
    onPostMessage: text => {
      dispatchProps.onPostMessage(stateProps.selectedConversationIDKey, text)
      ownProps.onScrollDown()
    },
    onStoreInputText: (inputText: string) => {
      if (stateProps.selectedConversationIDKey) {
        // only write if we're in a convo
        dispatchProps.onStoreInputText(stateProps.selectedConversationIDKey, inputText)
      }
    },
    onUpdateTyping: (typing: boolean) => {
      if (!typing) {
        // Update the not-typing status immediately, even if we're throttled.
        wrappedTyping.cancel()
        updateTyping(typing)
      } else {
        wrappedTyping(typing)
      }
    },
    onJoinChannel: () => dispatchProps.onJoinChannel(stateProps.selectedConversationIDKey),
    onLeaveChannel: () => {
      dispatchProps.onLeaveChannel(stateProps.selectedConversationIDKey, stateProps._meta.teamname)
    },
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  branch(props => props.hasResetUsers, renderNothing),
  // $FlowIssue doesn't like branch
  branch(props => props.isPreview, renderComponent(ChannelPreview)),
  withState('text', '_setText', props => props.defaultText || ''),
  withState('mentionPopupOpen', 'setMentionPopupOpen', false),
  withState('mentionFilter', 'setMentionFilter', ''),
  withHandlers(props => {
    let input
    // mutable value to store the latest text synchronously
    let _syncTextValue = ''
    return {
      inputClear: props => () => {
        input && input.setNativeProps({text: ''})
      },
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
        this.props.selectedConversationIDKey &&
        this.props.selectedConversationIDKey !== nextProps.selectedConversationIDKey
      ) {
        this.props.onStoreInputText(this.props.text)
        // withState won't get called again if props changes!
        this.props.setText(nextProps.defaultText)
      }
    },
  })
)(Input)
