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
const authorIsCollapsible = ({type}: Types.Message) =>
  type === 'text' || type === 'deleted' || type === 'attachment'

const getUsernameToShow = (
  message: Types.Message,
  previous: Types.Message | undefined,
  you: string,
  orangeLineAbove: boolean
) => {
  const {author} = message
  const sequentialUserMessages =
    previous?.author === author && authorIsCollapsible(message) && authorIsCollapsible(previous)

  const sequentialBotKeyed =
    previous?.author === author &&
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
      return !sequentialBotKeyed || !previous || !sequentialUserMessages || !!timestamp ? author : ''
    case 'setChannelname':
      // suppress this message for the #general channel, it is redundant.
      return (!previous || !sequentialUserMessages || !!timestamp) && message.newChannelname !== 'general'
        ? author
        : ''
    case 'systemAddedToTeam':
      return message.adder
    case 'systemInviteAccepted':
      return message.invitee === you ? '' : message.invitee
    case 'setDescription':
      return author
    case 'pin':
      return author
    case 'systemUsersAddedToConversation':
      return author
    case 'systemJoined':
      return message.joiners.length + message.leavers.length > 1 ? '' : author
    case 'systemSBSResolved':
      return message.prover
    case 'journeycard':
      return 'placeholder'
  }
  return author
}

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

const getDecorate = (message: Types.Message) => {
  switch (message.type) {
    case 'text': // fallthrough
    case 'attachment':
      return !message.exploded && !message.errorReason
    default:
      return true
  }
}

export default Container.namedConnect(
  (state, ownProps: OwnProps) => {
    const {conversationIDKey, ordinal, previous: previousOrdinal} = ownProps
    const {orangeLineMap, unfurlPromptMap, messageCenterOrdinals} = state.chat2
    const _participantInfo = Constants.getParticipantInfo(state, conversationIDKey)
    const message = Constants.getMessage(state, conversationIDKey, ordinal) || missingMessage
    const {type, id, author} = message
    const previous =
      (previousOrdinal && Constants.getMessage(state, conversationIDKey, previousOrdinal)) || undefined
    const orangeLineAbove = orangeLineMap.get(conversationIDKey) === id
    const hasUnfurlPrompts = type === 'text' && !!unfurlPromptMap.get(conversationIDKey)?.get(id)?.size
    const centeredOrdinalInfo = messageCenterOrdinals.get(conversationIDKey)
    const centeredOrdinal =
      centeredOrdinalInfo && centeredOrdinalInfo.ordinal === ordinal
        ? centeredOrdinalInfo.highlightMode
        : 'none'
    // TODO: possibly useTeamSubscribe here
    const meta = Constants.getMeta(state, conversationIDKey)
    const {teamname, teamID, botAliases} = meta
    const authorIsAdmin = teamname ? TeamConstants.userIsRoleInTeam(state, teamID, author, 'admin') : false
    const authorIsBot = Constants.messageAuthorIsBot(state, meta, message, _participantInfo)
    const authorIsOwner = teamname ? TeamConstants.userIsRoleInTeam(state, teamID, author, 'owner') : false
    const ordinals = [...Constants.getMessageOrdinals(state, conversationIDKey)]
    const botAlias = botAliases[author] ?? ''
    return {
      _you: state.config.username,
      authorIsAdmin,
      authorIsBot,
      authorIsOwner,
      botAlias,
      centeredOrdinal,
      conversationIDKey,
      hasUnfurlPrompts,
      isLastInThread: ordinals[ordinals.length - 1] === ordinal,
      isPendingPayment: Constants.isPendingPaymentMessage(state, message),
      message,
      orangeLineAbove,
      previous,
      shouldShowPopup: Constants.shouldShowPopup(state, message),
      showCoinsIcon: Constants.hasSuccessfulInlinePayments(state, message),
      showCrowns: true,
    }
  },
  dispatch => ({
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
    const {measure} = ownProps
    const {authorIsOwner, authorIsBot, authorIsAdmin, message, _you, botAlias} = stateProps
    const {centeredOrdinal, conversationIDKey, orangeLineAbove, isLastInThread, isPendingPayment} = stateProps
    const {previous, shouldShowPopup, showCoinsIcon, showCrowns, hasUnfurlPrompts} = stateProps
    const showUsername = getUsernameToShow(message, previous, _you, orangeLineAbove)
    // TODO type guard
    const outboxID: Types.OutboxID | null = (message as any).outboxID || null
    const {allowCancel, allowRetry, resolveByEdit, failureDescription} = getFailureDescriptionAllowCancel(
      message,
      _you
    )

    const {author, type, ordinal, id, deviceRevokedAt} = message

    // show send only if its possible we sent while you're looking at it
    const youAreAuthor = _you === author
    const showSendIndicator = youAreAuthor && ordinal !== id
    const decorate = getDecorate(message)
    const onCancel = allowCancel ? () => dispatchProps._onCancel(conversationIDKey, ordinal) : undefined
    const onRetry =
      allowRetry && !resolveByEdit && outboxID
        ? () => dispatchProps._onRetry(conversationIDKey, outboxID)
        : undefined

    // TODO type guard
    const forceAsh = !!(message as any).explodingUnreadable
    const textOrAttachment = type === 'attachment' || type === 'text'
    const isJoinLeave = type === 'systemJoined' || type === 'systemLeft'

    return {
      authorIsAdmin,
      authorIsBot,
      authorIsOwner,
      botAlias,
      centeredOrdinal,
      conversationIDKey,
      decorate,
      exploded: textOrAttachment && !!message.exploded,
      failureDescription,
      forceAsh,
      hasUnfurlPrompts,
      isJoinLeave,
      isLastInThread,
      isPendingPayment,
      isRevoked: textOrAttachment && !!deviceRevokedAt,
      measure,
      message,
      onAuthorClick: () => dispatchProps._onAuthorClick(showUsername),
      onCancel,
      onEdit: resolveByEdit ? () => dispatchProps._onEdit(conversationIDKey, ordinal) : undefined,
      onRetry,
      onSwipeLeft:
        stateProps.message.type !== 'journeycard'
          ? () => dispatchProps._onSwipeLeft(message.conversationIDKey, message.ordinal)
          : undefined,
      orangeLineAbove,
      previous,
      shouldShowPopup,
      showCoinsIcon,
      showCrowns,
      showSendIndicator,
      showUsername,
      youAreAuthor,
    }
  },
  'WrapperMessage'
)(WrapperMessage)
