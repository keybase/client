// @flow
import * as Constants from '../../../constants/chat'
import * as Creators from '../../../actions/chat/creators'
import HiddenString from '../../../util/hidden-string'
import Input from '.'
import {compose, withState, withHandlers, lifecycle} from 'recompose'
import {connect} from 'react-redux'
import {navigateAppend} from '../../../actions/route-tree'
import {throttle} from 'lodash'

import type {TypedState} from '../../../constants/reducer'
import type {Props} from '.'
import type {OwnProps} from './container'

const mapStateToProps = (state: TypedState, {focusInputCounter}: OwnProps) => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state)

  let isLoading = true
  let typing = []

  if (selectedConversationIDKey !== Constants.nothingSelected) {
    if (!Constants.isPendingConversationIDKey(selectedConversationIDKey || '')) {
      const conversationState = state.chat.get('conversationStates').get(selectedConversationIDKey)
      if (conversationState) {
        isLoading = !conversationState.isLoaded
        typing = conversationState.typing.toArray()
      }
    } else {
      // A conversation can't be loading if it's pending -- it doesn't exist
      // yet and we need to allow creating it.
      isLoading = false
    }
  }

  const routeState = Constants.getSelectedRouteState(state)
  const defaultText = (routeState && routeState.get('inputText', new HiddenString('')).stringValue()) || ''
  return {
    defaultText,
    editingMessage: state.chat.get('editingMessage'),
    focusInputCounter,
    isLoading,
    routeState,
    selectedConversationIDKey,
    typing,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onAttach: (selectedConversation, inputs: Array<Constants.AttachmentInput>) => {
    dispatch(
      navigateAppend([
        {props: {conversationIDKey: selectedConversation, inputs}, selected: 'attachmentInput'},
      ])
    )
  },
  onEditMessage: (message: Constants.Message, body: string) => {
    dispatch(Creators.editMessage(message, new HiddenString(body)))
  },
  onPostMessage: (selectedConversation, text) =>
    dispatch(Creators.postMessage(selectedConversation, new HiddenString(text))),
  onShowEditor: (message: Constants.Message) => {
    dispatch(Creators.showEditor(message))
  },
  onStoreInputText: (selectedConversation: Constants.ConversationIDKey, inputText: string) =>
    dispatch(Creators.setSelectedRouteState(selectedConversation, {inputText: new HiddenString(inputText)})),
  onUpdateTyping: (selectedConversation: Constants.ConversationIDKey, typing: boolean) => {
    dispatch(Creators.updateTyping(selectedConversation, typing))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps): Props => {
  const updateTyping = (typing: boolean) => {
    if (stateProps.selectedConversationIDKey) {
      dispatchProps.onUpdateTyping(stateProps.selectedConversationIDKey, typing)
    }
  }
  const wrappedTyping = throttle(updateTyping, 5000)

  return {
    ...stateProps,
    ...dispatchProps,
    onAttach: (inputs: Array<Constants.AttachmentInput>) =>
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
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  withState('text', 'setText', props => props.defaultText || ''),
  withHandlers(props => {
    let input
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
      inputValue: props => () => (input && input.getValue()) || '',
    }
  }),
  lifecycle({
    componentDidUpdate: function(prevProps) {
      if (this.props.focusInputCounter !== prevProps.focusInputCounter) {
        this.props.inputFocus()
      }
    },
    componentWillUnmount: function() {
      this.props.onStoreInputText(this.props.inputValue())
    },
    componentWillReceiveProps: function(nextProps) {
      if (
        this.props.selectedConversationIDKey &&
        this.props.selectedConversationIDKey !== nextProps.selectedConversationIDKey
      ) {
        this.props.onStoreInputText(this.props.inputValue())
        // withState won't get called again if props changes!
        this.props.setText(nextProps.defaultText)
      }
    },
  })
)(Input)
