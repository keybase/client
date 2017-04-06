// @flow
import * as Constants from '../../../constants/chat'
import * as Creators from '../../../actions/chat/creators'
import HiddenString from '../../../util/hidden-string'
import Input from '.'
import {compose, withState, withHandlers, lifecycle} from 'recompose'
import {connect} from 'react-redux'
import {navigateAppend} from '../../../actions/route-tree'

import type {TypedState} from '../../../constants/reducer'
import type {Props} from '.'

type OwnProps = {
  focusInputCounter: number,
  onEditLastMessage: () => void,
  onScrollDown: () => void,
}

const mapStateToProps = (state: TypedState, {focusInputCounter}: OwnProps) => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state)

  let isLoading = true

  if (!Constants.isPendingConversationIDKey(selectedConversationIDKey || '') &&
    selectedConversationIDKey !== Constants.nothingSelected) {
    const conversationState = state.chat.get('conversationStates').get(selectedConversationIDKey)
    if (conversationState) {
      isLoading = conversationState.isLoading
    }
  }

  const routeState = Constants.getSelectedRouteState(state)
  const defaultText = routeState && routeState.get('inputText', new HiddenString('')).stringValue() || ''
  return {
    defaultText,
    editingMessage: state.chat.get('editingMessage'),
    focusInputCounter,
    isLoading,
    routeState,
    selectedConversationIDKey,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onAttach: (selectedConversation, inputs: Array<Constants.AttachmentInput>) => { dispatch(navigateAppend([{props: {conversationIDKey: selectedConversation, inputs}, selected: 'attachmentInput'}])) },
  onEditMessage: (message: Constants.Message, body: string) => { dispatch(Creators.editMessage(message, new HiddenString(body))) },
  onPostMessage: (selectedConversation, text) => dispatch(Creators.postMessage(selectedConversation, new HiddenString(text))),
  onShowEditor: (message: Constants.Message) => { dispatch(Creators.showEditor(message)) },
  onStoreInputText: (selectedConversation: Constants.ConversationIDKey, inputText: string) => dispatch(Creators.setSelectedRouteState(selectedConversation, {inputText: new HiddenString(inputText)})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps): Props => ({
  ...stateProps,
  ...dispatchProps,
  onAttach: (inputs: Array<Constants.AttachmentInput>) => dispatchProps.onAttach(stateProps.selectedConversationIDKey, inputs),
  onEditLastMessage: ownProps.onEditLastMessage,
  onPostMessage: text => {
    dispatchProps.onPostMessage(stateProps.selectedConversationIDKey, text)
    ownProps.onScrollDown()
  },
  onStoreInputText: (inputText: string) => dispatchProps.onStoreInputText(stateProps.selectedConversationIDKey, inputText),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  withState('text', 'setText', props => props.defaultText || ''),
  withHandlers(
    props => {
      let input
      return {
        inputFocus: props => () => input && input.focus(),
        inputSelections: props => () => input && input.selections() || {},
        inputSetRef: props => i => { input = i },
        inputValue: props => () => input && input.getValue() || '',
      }
    }
  ),
  lifecycle({
    componentDidUpdate: function (prevProps) {
      if (!this.props.isLoading && prevProps.isLoading ||
        this.props.focusInputCounter !== prevProps.focusInputCounter) {
        this.props.inputFocus()
      }
    },
    componentWillReceiveProps: function (nextProps) {
      if (this.props.selectedConversationIDKey &&
          this.props.selectedConversationIDKey !== nextProps.selectedConversationIDKey) {
        this.props.onStoreInputText(this.props.inputValue())
      }
    },
  })
)(Input)
