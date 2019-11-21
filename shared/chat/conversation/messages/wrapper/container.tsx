import WrapperMessage from '.'
import * as Constants from '../../../../constants/chat2'
import * as TeamConstants from '../../../../constants/teams'
import * as MessageConstants from '../../../../constants/chat2/message'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as ProfileGen from '../../../../actions/profile-gen'
import * as Tracker2Gen from '../../../../actions/tracker2-gen'
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

// Used to decide whether to show the author for sequential messages
const authorIsCollapsible = (m: Types.Message) =>
  m.type === 'text' || m.type === 'deleted' || m.type === 'attachment'

const getUsernameToShow = (
  message: Types.Message,
  previous: Types.Message | undefined,
  you: string,
  orangeLineAbove: boolean
) => {
  const sequentialUserMessages =
    previous &&
    previous.author === message.author &&
    authorIsCollapsible(message) &&
    authorIsCollapsible(previous)

  const sequentialBotKeyed =
    previous &&
    previous.author === message.author &&
    previous.type === 'text' &&
    message.type === 'text' &&
    previous.botUsername === message.botUsername &&
    authorIsCollapsible(message) &&
    authorIsCollapsible(previous)

  const enoughTimeBetween = MessageConstants.enoughTimeBetweenMessages(message, previous)
  const timestamp = orangeLineAbove || !previous || enoughTimeBetween ? message.timestamp : null
  switch (message.type) {
    case 'attachment':
    case 'requestPayment':
    case 'sendPayment':
    case 'text':
      return !sequentialBotKeyed || !previous || !sequentialUserMessages || !!timestamp ? message.author : ''
    case 'setChannelname':
      // suppress this message for the #general channel, it is redundant.
      return (!previous || !sequentialUserMessages || !!timestamp) && message.newChannelname !== 'general'
        ? message.author
        : ''
    case 'systemAddedToTeam':
      return message.addee === you ? '' : message.addee
    case 'systemLeft':
    case 'systemJoined':
      return ''
    case 'systemInviteAccepted':
      return message.invitee === you ? '' : message.invitee
    case 'setDescription':
      return message.author
    case 'pin':
      return message.author
    case 'systemUsersAddedToConversation':
      return message.usernames.includes(you) ? '' : message.author
  }
  return ''
}

const getFailureDescriptionAllowCancel = (message, you) => {
  let failureDescription = ''
  let allowCancel = false
  let allowRetry = false
  let resolveByEdit = false
  if ((message.type === 'text' || message.type === 'attachment') && message.errorReason) {
    failureDescription = message.errorReason
    if (you && ['pending', 'failed'].includes(message.submitState)) {
      // This is a message still in the outbox, we can retry/edit to fix, but
      // for flip messages, don't allow retry/cancel
      allowCancel = allowRetry = message.type === 'attachment' || !message.flipGameID
      const messageType = message.type === 'attachment' ? 'attachment' : 'message'
      failureDescription = `This ${messageType} failed to send`
      resolveByEdit = !!message.outboxID && !!you && message.errorTyp === RPCChatTypes.OutboxErrorType.toolong
      if (resolveByEdit) {
        failureDescription += `, ${message.errorReason}`
      }
      if (!!message.outboxID && !!you) {
        switch (message.errorTyp) {
          case RPCChatTypes.OutboxErrorType.minwriter:
          case RPCChatTypes.OutboxErrorType.restrictedbot:
            failureDescription = `Unable to send, ${message.errorReason}`
            allowRetry = false
        }
      }
    }
  }
  return {allowCancel, allowRetry, failureDescription, resolveByEdit}
}

const getDecorate = message => {
  switch (message.type) {
    case 'text':
      return !message.exploded && !message.errorReason
    case 'attachment':
      return !message.exploded && !message.errorReason
    default:
      return true
  }
}

export default Container.namedConnect(
  (state: Container.TypedState, ownProps: OwnProps) => {
    const message =
      Constants.getMessage(state, ownProps.conversationIDKey, ownProps.ordinal) || missingMessage
    const previous =
      (ownProps.previous && Constants.getMessage(state, ownProps.conversationIDKey, ownProps.previous)) ||
      undefined
    const orangeLineAbove = state.chat2.orangeLineMap.get(ownProps.conversationIDKey) === message.id
    let hasUnfurlPrompts = false
    if (message.type === 'text') {
      const mm = state.chat2.unfurlPromptMap.get(message.conversationIDKey)
      if (mm) {
        const unfurlPrompts = mm.get(message.id)
        hasUnfurlPrompts = !!unfurlPrompts && unfurlPrompts.size > 0
      }
    }
    const centeredOrdinalInfo = state.chat2.messageCenterOrdinals.get(message.conversationIDKey)
    const centeredOrdinal =
      centeredOrdinalInfo && centeredOrdinalInfo.ordinal === ownProps.ordinal
        ? centeredOrdinalInfo.highlightMode
        : 'none'
    const meta = Constants.getMeta(state, message.conversationIDKey)
    const teamname = meta.teamname
    const authorIsAdmin = teamname
      ? TeamConstants.userIsRoleInTeam(state, teamname, message.author, 'admin')
      : false
    const authorIsOwner = teamname
      ? TeamConstants.userIsRoleInTeam(state, teamname, message.author, 'owner')
      : false
    const ordinals = [...Constants.getMessageOrdinals(state, ownProps.conversationIDKey)]
    const botAlias = (meta.botAliases && meta.botAliases[message.author]) ?? ''
    return {
      _you: state.config.username,
      authorIsAdmin,
      authorIsOwner,
      botAlias,
      centeredOrdinal,
      conversationIDKey: ownProps.conversationIDKey,
      hasUnfurlPrompts,
      isLastInThread: ordinals[ordinals.length - 1] === ownProps.ordinal,
      isPendingPayment: Constants.isPendingPaymentMessage(state, message),
      message,
      orangeLineAbove,
      previous,
      shouldShowPopup: Constants.shouldShowPopup(state, message),
      showCoinsIcon: Constants.hasSuccessfulInlinePayments(state, message),
      showCrowns: message.type !== 'systemAddedToTeam' && message.type !== 'systemInviteAccepted',
    }
  },
  (dispatch: Container.TypedDispatch) => ({
    _onAuthorClick: (username: string) =>
      Container.isMobile
        ? dispatch(ProfileGen.createShowUserProfile({username}))
        : dispatch(Tracker2Gen.createShowUser({asTracker: true, username})),
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
    const {previous, message, _you} = stateProps
    const showUsername = getUsernameToShow(message, previous, _you, stateProps.orangeLineAbove)
    // TODO type guard
    const outboxID: Types.OutboxID | null = (message as any).outboxID || null
    const {allowCancel, allowRetry, resolveByEdit, failureDescription} = getFailureDescriptionAllowCancel(
      message,
      _you
    )

    // show send only if its possible we sent while you're looking at it
    const youAreAuthor = _you === message.author
    const showSendIndicator = youAreAuthor && message.ordinal !== message.id
    const decorate = getDecorate(message)
    const onCancel = allowCancel
      ? () => dispatchProps._onCancel(message.conversationIDKey, message.ordinal)
      : undefined
    const onRetry =
      allowRetry && !resolveByEdit && outboxID
        ? () => dispatchProps._onRetry(message.conversationIDKey, outboxID)
        : undefined

    // TODO type guard
    const forceAsh = !!(message as any).explodingUnreadable

    return {
      authorIsAdmin: stateProps.authorIsAdmin,
      authorIsOwner: stateProps.authorIsOwner,
      botAlias: stateProps.botAlias,
      centeredOrdinal: stateProps.centeredOrdinal,
      conversationIDKey: stateProps.conversationIDKey,
      decorate,
      exploded: (message.type === 'attachment' || message.type === 'text') && message.exploded,
      failureDescription,
      forceAsh,
      hasUnfurlPrompts: stateProps.hasUnfurlPrompts,
      isJoinLeave: message.type === 'systemJoined' || message.type === 'systemLeft',
      isLastInThread: stateProps.isLastInThread,
      isPendingPayment: stateProps.isPendingPayment,
      isRevoked: (message.type === 'text' || message.type === 'attachment') && !!message.deviceRevokedAt,
      measure: ownProps.measure,
      message: message,
      onAuthorClick: () => dispatchProps._onAuthorClick(showUsername),
      onCancel,
      onEdit: resolveByEdit
        ? () => dispatchProps._onEdit(message.conversationIDKey, message.ordinal)
        : undefined,
      onRetry,
      onSwipeLeft: () => dispatchProps._onSwipeLeft(message.conversationIDKey, message.ordinal),
      orangeLineAbove: stateProps.orangeLineAbove,
      previous: stateProps.previous,
      shouldShowPopup: stateProps.shouldShowPopup,
      showCoinsIcon: stateProps.showCoinsIcon,
      showCrowns: stateProps.showCrowns,
      showSendIndicator,
      showUsername,
      youAreAuthor,
    }
  },
  'WrapperMessage'
)(WrapperMessage)
