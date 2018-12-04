// @flow
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as RouteTree from '../../../../actions/route-tree'
import HiddenString from '../../../../util/hidden-string'
import {connect} from '../../../../util/container'
import Input, {type Props} from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey,
  focusInputCounter: number,
  onScrollDown: () => void,
}

// We used to store this in the route state but that's so complicated. We just want a map of id => text if we haven't sent
const unsentText: {[Types.ConversationIDKey]: string} = {}

const getUnsentText = (conversationIDKey: Types.ConversationIDKey): string => {
  return unsentText[conversationIDKey] || ''
}

const setUnsentText = (conversationIDKey: Types.ConversationIDKey, text: string) => {
  unsentText[conversationIDKey] = text
}

const mapStateToProps = (state, {conversationIDKey}: OwnProps) => {
  const editInfo = Constants.getEditInfo(state, conversationIDKey)
  const quoteInfo = Constants.getQuoteInfo(state, conversationIDKey)

  const _you = state.config.username || ''

  const explodingModeSeconds = Constants.getConversationExplodingMode(state, conversationIDKey)
  const isExploding = explodingModeSeconds !== 0

  return {
    _editOrdinal: editInfo ? editInfo.ordinal : null,
    _isExplodingModeLocked: Constants.isExplodingModeLocked(state, conversationIDKey),
    _you,
    conversationIDKey,
    editText: editInfo ? editInfo.text : '',
    explodingModeSeconds,
    isEditExploded: editInfo ? editInfo.exploded : false,
    isExploding,
    isExplodingNew: Constants.getIsExplodingNew(state),
    quoteCounter: quoteInfo ? quoteInfo.counter : 0,
    quoteText: quoteInfo ? quoteInfo.text : '',
    showWalletsIcon: Constants.shouldShowWalletsIcon(Constants.getMeta(state, conversationIDKey), _you),
    typing: Constants.getTyping(state, conversationIDKey),
  }
}

const mapDispatchToProps = dispatch => ({
  _onAttach: (conversationIDKey: Types.ConversationIDKey, paths: Array<string>) => {
    const pathAndOutboxIDs = paths.map(p => ({
      path: p,
      outboxID: null,
    }))
    dispatch(
      RouteTree.navigateAppend([
        {props: {conversationIDKey, pathAndOutboxIDs}, selected: 'attachmentGetTitles'},
      ])
    )
  },
  _onCancelEditing: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createMessageSetEditing({conversationIDKey, ordinal: null})),
  _onEditLastMessage: (conversationIDKey: Types.ConversationIDKey, you: string) =>
    dispatch(
      Chat2Gen.createMessageSetEditing({
        conversationIDKey,
        editLastUser: you,
        ordinal: null,
      })
    ),
  _onEditMessage: (conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal, body: string) =>
    dispatch(
      Chat2Gen.createMessageEdit({
        conversationIDKey,
        ordinal,
        text: new HiddenString(body),
      })
    ),
  _onPostMessage: (conversationIDKey: Types.ConversationIDKey, text: string) =>
    dispatch(Chat2Gen.createMessageSend({conversationIDKey, text: new HiddenString(text)})),
  _sendTyping: (conversationIDKey: Types.ConversationIDKey, typing: boolean) =>
    // only valid conversations
    conversationIDKey && dispatch(Chat2Gen.createSendTyping({conversationIDKey, typing})),
  clearInboxFilter: () => dispatch(Chat2Gen.createSetInboxFilter({filter: ''})),
  onSeenExplodingMessages: () => dispatch(Chat2Gen.createHandleSeeingExplodingMessages()),
  onSetExplodingModeLock: (conversationIDKey: Types.ConversationIDKey, unset: boolean) =>
    dispatch(Chat2Gen.createSetExplodingModeLock({conversationIDKey, unset})),
  onFilePickerError: (error: Error) => dispatch(Chat2Gen.createFilePickerError({error})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps): Props => ({
  clearInboxFilter: dispatchProps.clearInboxFilter,
  conversationIDKey: stateProps.conversationIDKey,
  editText: stateProps.editText,
  explodingModeSeconds: stateProps.explodingModeSeconds,
  focusInputCounter: ownProps.focusInputCounter,
  getUnsentText: () => getUnsentText(stateProps.conversationIDKey),
  isEditExploded: stateProps.isEditExploded,
  isEditing: !!stateProps._editOrdinal,
  isExploding: stateProps.isExploding,
  isExplodingNew: stateProps.isExplodingNew,
  onAttach: (paths: Array<string>) => dispatchProps._onAttach(stateProps.conversationIDKey, paths),
  onCancelEditing: () => dispatchProps._onCancelEditing(stateProps.conversationIDKey),
  onFilePickerError: dispatchProps.onFilePickerError,
  onEditLastMessage: () => dispatchProps._onEditLastMessage(stateProps.conversationIDKey, stateProps._you),
  onSeenExplodingMessages: dispatchProps.onSeenExplodingMessages,
  onSubmit: (text: string) => {
    if (stateProps._editOrdinal) {
      dispatchProps._onEditMessage(stateProps.conversationIDKey, stateProps._editOrdinal, text)
    } else {
      dispatchProps._onPostMessage(stateProps.conversationIDKey, text)
    }
  },
  quoteCounter: stateProps.quoteCounter,
  quoteText: stateProps.quoteText,
  sendTyping: (typing: boolean) => {
    dispatchProps._sendTyping(stateProps.conversationIDKey, typing)
  },
  setUnsentText: (text: string) => {
    const unset = text.length <= 0
    if (stateProps._isExplodingModeLocked ? unset : !unset) {
      // if it's locked and we want to unset, unset it
      // alternatively, if it's not locked and we want to set it, set it
      dispatchProps.onSetExplodingModeLock(stateProps.conversationIDKey, unset)
    }
    setUnsentText(stateProps.conversationIDKey, text)
  },
  showWalletsIcon: stateProps.showWalletsIcon,
  typing: stateProps.typing,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Input)
