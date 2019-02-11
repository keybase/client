// @flow
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as ConfigGen from '../../../../actions/config-gen'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import HiddenString from '../../../../util/hidden-string'
import {connect} from '../../../../util/container'
import Input, {type Props} from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey,
  focusInputCounter: number,
  onRequestScrollDown: () => void,
  onRequestScrollUp: () => void,
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
  const meta = Constants.getMeta(state, conversationIDKey)
  // don't include 'small' here to ditch the single #general suggestion
  const teamname = meta.teamType === 'big' ? meta.teamname : ''

  const _you = state.config.username || ''

  const explodingModeSeconds = Constants.getConversationExplodingMode(state, conversationIDKey)
  const isExploding = explodingModeSeconds !== 0
  const unsentText = state.chat2.unsentTextMap.get(conversationIDKey)
  return {
    _editOrdinal: editInfo ? editInfo.ordinal : null,
    _isExplodingModeLocked: Constants.isExplodingModeLocked(state, conversationIDKey),
    _you,
    conversationIDKey,
    editText: editInfo ? editInfo.text : '',
    explodingModeSeconds,
    isActiveForFocus: state.chat2.focus === null,
    isEditExploded: editInfo ? editInfo.exploded : false,
    isExploding,
    quoteCounter: quoteInfo ? quoteInfo.counter : 0,
    quoteText: quoteInfo ? quoteInfo.text : '',
    showWalletsIcon: Constants.shouldShowWalletsIcon(state, conversationIDKey),
    suggestChannels: Constants.getChannelSuggestions(state, teamname),
    suggestCommands: Constants.getCommands(state, conversationIDKey),
    suggestUsers: Constants.getParticipantSuggestions(state, conversationIDKey),
    typing: Constants.getTyping(state, conversationIDKey),
    unsentText: unsentText ? unsentText.stringValue() : '',
  }
}

const mapDispatchToProps = dispatch => ({
  _clearUnsentText: (conversationIDKey: Types.ConversationIDKey) => {
    dispatch(Chat2Gen.createSetUnsentText({conversationIDKey, text: new HiddenString('')}))
  },
  _onAttach: (conversationIDKey: Types.ConversationIDKey, paths: Array<string>) => {
    const pathAndOutboxIDs = paths.map(p => ({
      outboxID: null,
      path: p,
    }))
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {conversationIDKey, pathAndOutboxIDs}, selected: 'attachmentGetTitles'}],
      })
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
  _sendTyping: (conversationIDKey: Types.ConversationIDKey, text: string) =>
    // only valid conversations
    conversationIDKey &&
    dispatch(Chat2Gen.createSendTyping({conversationIDKey, text: new HiddenString(text)})),
  clearInboxFilter: () => dispatch(Chat2Gen.createSetInboxFilter({filter: ''})),
  onFilePickerError: (error: Error) => dispatch(ConfigGen.createFilePickerError({error})),
  onSetExplodingModeLock: (conversationIDKey: Types.ConversationIDKey, unset: boolean) =>
    dispatch(Chat2Gen.createSetExplodingModeLock({conversationIDKey, unset})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps): Props => ({
  clearInboxFilter: dispatchProps.clearInboxFilter,
  conversationIDKey: stateProps.conversationIDKey,
  editText: stateProps.editText,
  explodingModeSeconds: stateProps.explodingModeSeconds,
  focusInputCounter: ownProps.focusInputCounter,
  getUnsentText: () =>
    stateProps.unsentText.length > 0 ? stateProps.unsentText : getUnsentText(stateProps.conversationIDKey),
  isActiveForFocus: stateProps.isActiveForFocus,
  isEditExploded: stateProps.isEditExploded,
  isEditing: !!stateProps._editOrdinal,
  isExploding: stateProps.isExploding,
  onAttach: (paths: Array<string>) => dispatchProps._onAttach(stateProps.conversationIDKey, paths),
  onCancelEditing: () => dispatchProps._onCancelEditing(stateProps.conversationIDKey),
  onEditLastMessage: () => dispatchProps._onEditLastMessage(stateProps.conversationIDKey, stateProps._you),
  onFilePickerError: dispatchProps.onFilePickerError,
  onRequestScrollDown: ownProps.onRequestScrollDown,
  onRequestScrollUp: ownProps.onRequestScrollUp,
  onSubmit: (text: string) => {
    if (stateProps._editOrdinal) {
      dispatchProps._onEditMessage(stateProps.conversationIDKey, stateProps._editOrdinal, text)
    } else {
      dispatchProps._onPostMessage(stateProps.conversationIDKey, text)
    }
  },
  quoteCounter: stateProps.quoteCounter,
  quoteText: stateProps.quoteText,
  sendTyping: (text: string) => {
    dispatchProps._sendTyping(stateProps.conversationIDKey, text)
  },
  setUnsentText: (text: string) => {
    const unset = text.length <= 0
    if (stateProps._isExplodingModeLocked ? unset : !unset) {
      // if it's locked and we want to unset, unset it
      // alternatively, if it's not locked and we want to set it, set it
      dispatchProps.onSetExplodingModeLock(stateProps.conversationIDKey, unset)
    }
    if (stateProps.unsentText.length > 0) {
      dispatchProps._clearUnsentText(stateProps.conversationIDKey)
    }
    setUnsentText(stateProps.conversationIDKey, text)
  },
  showWalletsIcon: stateProps.showWalletsIcon,
  suggestChannels: stateProps.suggestChannels,
  suggestCommands: stateProps.suggestCommands,
  suggestUsers: stateProps.suggestUsers,
  unsentTextRefresh: stateProps.unsentText.length > 0,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Input)
