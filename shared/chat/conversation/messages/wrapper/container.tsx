import WrapperMessage from '.'
import * as Constants from '../../../../constants/chat2'
import * as TeamConstants from '../../../../constants/teams'
import * as MessageConstants from '../../../../constants/chat2/message'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Types from '../../../../constants/types/chat2'
import * as Container from '../../../../util/container'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  measure?: () => void
  ordinal: Types.Ordinal
  previous?: Types.Ordinal
}

// If there is no matching message treat it like a deleted
const missingMessage = MessageConstants.makeMessageDeleted({})

const getFailureDescriptionAllowCancel = (message: Types.Message, you: string) => {
  let failureDescription = ''
  let allowCancel = false
  let allowRetry = false
  let resolveByEdit = false
  const {type, errorReason} = message
  if ((type === 'text' || type === 'attachment') && errorReason) {
    failureDescription = errorReason
    if (you && ['pending', 'failed'].includes(message.submitState as string)) {
      // This is a message still in the outbox, we can retry/edit to fix, but
      // for flip messages, don't allow retry/cancel
      allowCancel = allowRetry =
        message.type === 'attachment' || (message.type === 'text' && !message.flipGameID)
      const messageType = type === 'attachment' ? 'attachment' : 'message'
      failureDescription = `This ${messageType} failed to send`
      resolveByEdit = !!message.outboxID && !!you && message.errorTyp === RPCChatTypes.OutboxErrorType.toolong
      if (resolveByEdit) {
        failureDescription += `, ${errorReason}`
      }
      if (!!message.outboxID && !!you) {
        switch (message.errorTyp) {
          case RPCChatTypes.OutboxErrorType.minwriter:
          case RPCChatTypes.OutboxErrorType.restrictedbot:
            failureDescription = `Unable to send, ${errorReason}`
            allowRetry = false
        }
      }
    }
  }
  return {allowCancel, allowRetry, failureDescription, resolveByEdit}
}

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const {conversationIDKey, ordinal, previous: previousOrdinal} = ownProps
    const {orangeLineMap} = state.chat2
    const _participantInfo = Constants.getParticipantInfo(state, conversationIDKey)
    const message = Constants.getMessage(state, conversationIDKey, ordinal) || missingMessage
    const {id, author} = message
    const previous =
      (previousOrdinal && Constants.getMessage(state, conversationIDKey, previousOrdinal)) || undefined
    const orangeLineAbove = orangeLineMap.get(conversationIDKey) === id
    // TODO: possibly useTeamSubscribe here
    const meta = Constants.getMeta(state, conversationIDKey)
    const {teamname, teamID} = meta
    const authorIsAdmin = teamname ? TeamConstants.userIsRoleInTeam(state, teamID, author, 'admin') : false
    const authorIsBot = Constants.messageAuthorIsBot(state, meta, message, _participantInfo)
    const authorIsOwner = teamname ? TeamConstants.userIsRoleInTeam(state, teamID, author, 'owner') : false
    return {
      _you: state.config.username,
      authorIsAdmin,
      authorIsBot,
      authorIsOwner,
      conversationIDKey,
      message,
      orangeLineAbove,
      previous,
      shouldShowPopup: Constants.shouldShowPopup(state, message),
      showCrowns: true,
    }
  },
  dispatch => ({
    _onCancel: (conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal) =>
      dispatch(Chat2Gen.createMessageDelete({conversationIDKey, ordinal})),
    _onEdit: (conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal) =>
      dispatch(Chat2Gen.createMessageSetEditing({conversationIDKey, ordinal})),
    _onRetry: (conversationIDKey: Types.ConversationIDKey, outboxID: Types.OutboxID) =>
      dispatch(Chat2Gen.createMessageRetry({conversationIDKey, outboxID})),
    _onSwipeLeft: (conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal) =>
      dispatch(Chat2Gen.createToggleReplyToMessage({conversationIDKey, ordinal})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const {measure} = ownProps
    const {message, _you} = stateProps
    const {conversationIDKey, orangeLineAbove} = stateProps
    const {previous, shouldShowPopup, showCrowns} = stateProps
    // TODO type guard
    const outboxID: Types.OutboxID | null = (message as any).outboxID || null
    const {allowCancel, allowRetry, resolveByEdit} = getFailureDescriptionAllowCancel(message, _you)

    const {author, ordinal, id} = message

    // show send only if its possible we sent while you're looking at it
    const youAreAuthor = _you === author
    const showSendIndicator = youAreAuthor && ordinal !== id
    const onCancel = allowCancel ? () => dispatchProps._onCancel(conversationIDKey, ordinal) : undefined
    const onRetry =
      allowRetry && !resolveByEdit && outboxID
        ? () => dispatchProps._onRetry(conversationIDKey, outboxID)
        : undefined

    return {
      conversationIDKey,
      measure,
      message,
      onCancel,
      onEdit: resolveByEdit ? () => dispatchProps._onEdit(conversationIDKey, ordinal) : undefined,
      onRetry,
      onSwipeLeft:
        stateProps.message.type !== 'journeycard'
          ? () => dispatchProps._onSwipeLeft(message.conversationIDKey, message.ordinal)
          : undefined,
      orangeLineAbove,
      ordinal: ownProps.ordinal,
      previous,
      shouldShowPopup,
      showCrowns,
      showSendIndicator,
      youAreAuthor,
    }
  }
)(WrapperMessage)
