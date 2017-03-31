// @flow
import * as Constants from '../../../constants/chat'
import Input from '.'
import {compose, withState, withHandlers, lifecycle} from 'recompose'
import {connect} from 'react-redux'

import type {TypedState} from '../../../constants/reducer'

type OwnProps = {
  defaultText: ?string,
  focusInputCounter: number,
  selectedConversationIDKey: ?Constants.ConversationIDKey,
  onStoreInputText: (text: string) => void,
  onAttach: (inputs: Array<Constants.AttachmentInput>) => void,
  onEditLastMessage: () => void,
  onPostMessage: (text: string) => void,
}

const mapStateToProps = (state: TypedState, {defaultText, focusInputCounter, selectedConversationIDKey}: OwnProps) => {
  let isLoading = false
  if (selectedConversationIDKey !== Constants.nothingSelected) {
    const conversationState = state.chat.get('conversationStates').get(selectedConversationIDKey)
    if (conversationState) {
      isLoading = conversationState.isLoading
    }
  }

  return {
    defaultText,
    editingMessage: state.chat.get('editingMessage'),
    focusInputCounter,
    isLoading,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {onStoreInputText, onAttach, onEditLastMessage, onPostMessage}: OwnProps) => ({
  onAttach,
  onEditLastMessage,
  onPostMessage,
  onStoreInputText,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
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
    componentWillUnmount: function () {
      this.props.onStoreInputText(this.props.inputValue())
    },
  })
)(Input)
