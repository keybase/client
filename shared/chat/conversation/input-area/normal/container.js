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
import {isEqual, throttle} from 'lodash-es'
import {chatTab} from '../../../../constants/tabs'
import mentionHoc, {type PropsFromContainer} from '../mention-handler-hoc'

type OwnProps = {
  focusInputCounter: number,
  onScrollDown: () => void,
}

// We used to store this in the route state but that's so complicated. We just want a map of id => text if we haven't sent
const unsentText = {}

const mapStateToProps = (state: TypedState, {conversationIDKey}) => {
  const editingOrdinal = Constants.getEditingOrdinal(state, conversationIDKey)
  const _editingMessage: ?Types.Message = editingOrdinal
    ? Constants.getMessageMap(state, conversationIDKey).get(editingOrdinal)
    : null
  const quote = Constants.getQuotingOrdinalAndSource(
    state,
    state.chat2.pendingSelected ? Constants.pendingConversationIDKey : conversationIDKey
  )
  let _quotingMessage: ?Types.Message = null
  if (quote) {
    const {ordinal, sourceConversationIDKey} = quote
    _quotingMessage = ordinal ? Constants.getMessageMap(state, sourceConversationIDKey).get(ordinal) : null
  }

  // Sanity check -- is this quoted-pending message for the right person?
  if (
    state.chat2.pendingSelected &&
    _quotingMessage &&
    !isEqual([_quotingMessage.author], state.chat2.pendingConversationUsers.toArray())
  ) {
    console.warn(
      'Should never happen:',
      state.chat2.pendingConversationUsers.toArray(),
      'vs',
      _quotingMessage.author
    )
    _quotingMessage = null
  }

  const _you = state.config.username || ''
  const pendingWaiting = state.chat2.pendingSelected && state.chat2.pendingStatus === 'waiting'

  const injectedInputMessage: ?Types.Message = _editingMessage || _quotingMessage || null
  const injectedInput: string =
    injectedInputMessage && injectedInputMessage.type === 'text'
      ? injectedInputMessage.text.stringValue()
      : ''

  return {
    _editingMessage,
    _meta: Constants.getMeta(state, conversationIDKey),
    _quotingMessage,
    _you,
    conversationIDKey,
    injectedInput,
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
    dispatch(
      Chat2Gen.createMessageSetQuoting({
        ordinal: null,
        sourceConversationIDKey: conversationIDKey,
        targetConversationIDKey: conversationIDKey,
      })
    ),
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
  injectedInput: stateProps.injectedInput,
  isEditing: !!stateProps._editingMessage,
  isLoading: false,
  onAttach: (paths: Array<string>) => dispatchProps._onAttach(stateProps.conversationIDKey, paths),
  onCancelEditing: () => {
    dispatchProps._onCancelQuoting(stateProps.conversationIDKey)
    dispatchProps._onCancelEditing(stateProps.conversationIDKey)
  },
  onCancelQuoting: () => dispatchProps._onCancelQuoting(stateProps.conversationIDKey),
  onEditLastMessage: () => dispatchProps._onEditLastMessage(stateProps.conversationIDKey, stateProps._you),
  pendingWaiting: stateProps.pendingWaiting,
  sendTyping: (typing: boolean) => dispatchProps._sendTyping(stateProps.conversationIDKey, typing),
  typing: stateProps.typing,
})

// Standalone throttled function to ensure we never accidentally recreate it and break the throttling
const throttled = throttle((f, param) => f(param), 1000)

// With the heavy use of recompose below, it's pretty difficult to
// figure out the types passed into the various handlers. This type is
// good enough to use in the lifecycle methods.
type LifecycleProps = PropsFromContainer & {
  _quotingMessage: ?Types.Message,
  _editingMessage: ?Types.Message,
  setText: (string, skipUnsentSaving?: boolean) => void,
  injectedInput: string,
  inputMoveToEnd: () => void,
}

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
        props._quotingMessage && props.onCancelQuoting()
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
    // The types for prevProps and nextProps aren't exact, but they're
    // good enough.
    componentDidUpdate(prevProps: LifecycleProps) {
      if (this.props.focusInputCounter !== prevProps.focusInputCounter) {
        this.props.inputFocus()
      }
    },
    componentWillReceiveProps(nextProps: LifecycleProps) {
      const props: LifecycleProps = this.props

      // Fill in the input with an edit, quote, or unsent text
      if (
        (nextProps._quotingMessage && nextProps._quotingMessage !== props._quotingMessage) ||
        nextProps._editingMessage !== props._editingMessage
      ) {
        props.setText('') // blow away any unset stuff if we go into an edit/quote, else you edit / cancel / switch tabs and come back and you see the unsent value
        const injectedInput = nextProps.injectedInput
        props.setText(
          nextProps._quotingMessage && !nextProps._editingMessage
            ? formatTextForQuoting(injectedInput)
            : injectedInput,
          true
        )
        !isMobile && props.inputMoveToEnd()
        props.inputFocus()
      } else if (props.conversationIDKey !== nextProps.conversationIDKey && !nextProps.injectedInput) {
        const text = unsentText[Types.conversationIDKeyToString(nextProps.conversationIDKey)] || ''
        props.setText(text, true)
      }

      if (nextProps.isEditing && !props.isEditing) {
        props.inputFocus()
      }
    },
  }),
  mentionHoc
)(Input)
