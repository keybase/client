// @flow
import * as I from 'immutable'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as RouteTree from '../../../../actions/route-tree'
import HiddenString from '../../../../util/hidden-string'
import {formatTextForQuoting} from '../../../../util/chat'
import Input from '.'
import {
  compose,
  withHandlers,
  withStateHandlers,
  withProps,
  lifecycle,
  connect,
  isMobile,
  type TypedState,
  type Dispatch,
} from '../../../../util/container'
import throttle from 'lodash/throttle'
import {chatTab} from '../../../../constants/tabs'
import mentionHoc from '../mention-handler-hoc'

type OwnProps = {
  focusInputCounter: number,
  onScrollDown: () => void,
}

// We used to store this in the route state but thats so complicated. We just want a map of id => text if we haven't sent
const unsentText = {}

const mapStateToProps = (state: TypedState, {conversationIDKey}) => {
  const editingOrdinal = Constants.getEditingOrdinal(state, conversationIDKey)
  const _editingMessage = editingOrdinal
    ? Constants.getMessageMap(state, conversationIDKey).get(editingOrdinal)
    : null
  const quotingOrdinal = Constants.getQuotingOrdinal(state, conversationIDKey)
  console.warn({quotingOrdinal})
  const _quotingMessage = quotingOrdinal
    ? Constants.getMessageMap(state, conversationIDKey).get(quotingOrdinal)
    : null
  console.warn({_quotingMessage})
  const _you = state.config.username || ''
  const pendingWaiting = state.chat2.pendingSelected && state.chat2.pendingStatus === 'waiting'

  return {
    _editingMessage,
    _meta: Constants.getMeta(state, conversationIDKey),
    _quotingMessage,
    _you,
    conversationIDKey,
    pendingWaiting,
    typing: Constants.getTyping(state, conversationIDKey),
  }
}

const mapDispatchToProps = (dispatch: Dispatch): * => ({
  _onAttach: (conversationIDKey: Types.ConversationIDKey, paths: Array<string>) =>
    dispatch(
      RouteTree.navigateAppend([{props: {conversationIDKey, paths}, selected: 'attachmentGetTitles'}])
    ),
  _onCancelEditing: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createMessageSetEditing({conversationIDKey, ordinal: null})),
  _onCancelQuoting: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createMessageSetQuoting({conversationIDKey, ordinal: null})),
  _onEditLastMessage: (conversationIDKey: Types.ConversationIDKey, you: string) =>
    dispatch(
      Chat2Gen.createMessageSetEditing({
        conversationIDKey,
        editLastUser: you,
        ordinal: null,
      })
    ),
  _onEditMessage: (message: Types.Message, body: string) =>
    dispatch(
      Chat2Gen.createMessageEdit({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.ordinal,
        text: new HiddenString(body),
      })
    ),
  _onPostMessage: (conversationIDKey: Types.ConversationIDKey, text: string) =>
    dispatch(Chat2Gen.createMessageSend({conversationIDKey, text: new HiddenString(text)})),
  _onStoreInputText: (conversationIDKey: Types.ConversationIDKey, inputText: string) =>
    dispatch(
      RouteTree.setRouteState(I.List([chatTab, conversationIDKey]), {inputText: new HiddenString(inputText)})
    ),
  _sendTyping: (conversationIDKey: Types.ConversationIDKey, typing: boolean) =>
    // only valid conversations
    conversationIDKey && dispatch(Chat2Gen.createSendTyping({conversationIDKey, typing})),
  clearInboxFilter: () => dispatch(Chat2Gen.createSetInboxFilter({filter: ''})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  _editingMessage: stateProps._editingMessage,
  _onSubmit: (text: string) => {
    const em = stateProps._editingMessage
    if (em) {
      if (em.type === 'text' && em.text.stringValue() === text) {
        dispatchProps._onCancelEditing(stateProps.conversationIDKey)
      } else {
        dispatchProps._onEditMessage(em, text)
      }
    } else {
      dispatchProps._onPostMessage(stateProps.conversationIDKey, text)
    }
    ownProps.onScrollDown()
  },
  _quotingMessage: stateProps._quotingMessage,
  channelName: stateProps._meta.channelname,
  clearInboxFilter: dispatchProps.clearInboxFilter,
  conversationIDKey: stateProps.conversationIDKey,
  focusInputCounter: ownProps.focusInputCounter,
  isEditing: !!stateProps._editingMessage,
  isLoading: false,
  onAttach: (paths: Array<string>) => dispatchProps._onAttach(stateProps.conversationIDKey, paths),
  onCancelEditing: () => dispatchProps._onCancelEditing(stateProps.conversationIDKey),
  onCancelQuoting: () => dispatchProps._onCancelQuoting(stateProps.conversationIDKey),
  onEditLastMessage: () => dispatchProps._onEditLastMessage(stateProps.conversationIDKey, stateProps._you),
  pendingWaiting: stateProps.pendingWaiting,
  sendTyping: (typing: boolean) => dispatchProps._sendTyping(stateProps.conversationIDKey, typing),
  typing: stateProps.typing,
})

// Standalone throttled function to ensure we never accidentally recreate it and break the throttling
const throttled = throttle((f, param) => f(param), 1000)

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  withStateHandlers(
    props => ({text: unsentText[Types.conversationIDKeyToString(props.conversationIDKey)] || ''}),
    {
      _setText: () => (text: string) => ({text}),
    }
  ),
  withProps(props => ({
    setText: (text: string, skipUnsentSaving?: boolean) => {
      props._setText(text)
      if (!skipUnsentSaving) {
        unsentText[Types.conversationIDKeyToString(props.conversationIDKey)] = text
      }

      throttled(props.sendTyping, !!text)
    },
  })),
  withProps(props => ({
    onSubmit: (text: string) => {
      props._onSubmit(text)
      props.setText('')
    },
  })),
  withHandlers(props => {
    let input
    return {
      _inputSetRef: props => i => (input = i),
      _onKeyDown: props => (e: SyntheticKeyboardEvent<>) => {
        if (e.key === 'ArrowUp' && !props.text) {
          props.onEditLastMessage()
        } else if (e.key === 'Escape') {
          props.onCancelEditing()
        }
      },
      inputBlur: props => () => input && input.blur(),
      inputFocus: props => () => input && input.focus(),
      inputMoveToEnd: props => () => input && input.moveCursorToEnd(),
      inputGetRef: props => () => input,
      inputSelections: props => () => (input && input.selections()) || {},
    }
  }),
  lifecycle({
    componentDidUpdate(prevProps) {
      if (this.props.focusInputCounter !== prevProps.focusInputCounter) {
        this.props.inputFocus()
      }
    },
    componentWillReceiveProps(nextProps) {
      // Fill in the input with an edit or unsent text
      if (this.props._editingMessage !== nextProps._editingMessage) {
        const text =
          nextProps._editingMessage && nextProps._editingMessage.type === 'text'
            ? nextProps._editingMessage.text.stringValue()
            : ''
        this.props.setText('') // blow away any unset stuff if we go into an edit, else you edit / cancel / switch tabs and come back and you see the unsent value
        this.props.setText(text, true)
        !isMobile && this.props.inputMoveToEnd()
      } else if (this.props._quotingMessage !== nextProps._quotingMessage) {
        const text =
          nextProps._quotingMessage && nextProps._quotingMessage.type === 'text'
            ? nextProps._quotingMessage.text.stringValue()
            : ''

        const newText = text && formatTextForQuoting(text)
        if (text) {
          this.props.setText('') // blow away any unset stuff if we go into a quote, else you edit / cancel / switch tabs and come back and you see the unsent value
          this.props.setText(newText, true)
          // clear out the quoting ordinal too
          this.props.onCancelQuoting(nextProps.conversationIDKey)
          !isMobile && this.props.inputMoveToEnd()
          this.props.inputFocus()
        }
      } else if (this.props.conversationIDKey !== nextProps.conversationIDKey) {
        const text = unsentText[Types.conversationIDKeyToString(nextProps.conversationIDKey)] || ''
        this.props.setText(text, true)
      }

      if (nextProps.isEditing && !this.props.isEditing) {
        this.props.inputFocus()
      }
    },
  }),
  mentionHoc
)(Input)
