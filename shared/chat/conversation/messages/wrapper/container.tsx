import WrapperMessage from '.'
import * as Constants from '../../../../constants/chat2'
import * as TeamConstants from '../../../../constants/teams'
import * as MessageConstants from '../../../../constants/chat2/message'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as ProfileGen from '../../../../actions/profile-gen'
import * as Tracker2Gen from '../../../../actions/tracker2-gen'
import * as Types from '../../../../constants/types/chat2'
import * as Container from '../../../../util/container'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  measure?: () => void
  ordinal: Types.Ordinal
  previous?: Types.Ordinal
}

// If there is no matching message treat it like a deleted
const missingMessage = MessageConstants.makeMessageDeleted({})

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const message = Constants.getMessage(state, ownProps.conversationIDKey, ownProps.ordinal) || missingMessage
  const previous =
    (ownProps.previous && Constants.getMessage(state, ownProps.conversationIDKey, ownProps.previous)) ||
    undefined
  const orangeLineAbove = state.chat2.orangeLineMap.get(ownProps.conversationIDKey) === message.id
  const unfurlPrompts =
    message.type === 'text'
      ? state.chat2.unfurlPromptMap.getIn([message.conversationIDKey, message.id])
      : null
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
  return {
    _you: state.config.username,
    authorIsAdmin,
    authorIsOwner,
    centeredOrdinal,
    conversationIDKey: ownProps.conversationIDKey,
    hasUnfurlPrompts: !!unfurlPrompts && !unfurlPrompts.isEmpty(),
    isLastInThread:
      Constants.getMessageOrdinals(state, ownProps.conversationIDKey).last() === ownProps.ordinal,
    isPendingPayment: Constants.isPendingPaymentMessage(state, message),
    message,
    orangeLineAbove,
    previous,
    shouldShowPopup: Constants.shouldShowPopup(state, message),
    showCoinsIcon: Constants.hasSuccessfulInlinePayments(state, message),
    showCrowns: message.type !== 'systemAddedToTeam' && message.type !== 'systemInviteAccepted',
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
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
})

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

  const enoughTimeBetween = MessageConstants.enoughTimeBetweenMessages(message, previous)
  const timestamp = orangeLineAbove || !previous || enoughTimeBetween ? message.timestamp : null
  switch (message.type) {
    case 'attachment':
    case 'requestPayment':
    case 'sendPayment':
    case 'text':
    case 'setChannelname':
      return !previous || !sequentialUserMessages || !!timestamp ? message.author : ''
    case 'systemAddedToTeam':
      return message.addee === you ? '' : message.addee
    case 'systemLeft':
    case 'systemJoined':
      return ''
    case 'systemInviteAccepted':
      return message.invitee === you ? '' : message.invitee
    case 'setDescription':
      return message.author
    case 'systemUsersAddedToConversation':
      return message.usernames.includes(you) ? '' : message.author
  }
  return ''
}

const getFailureDescriptionAllowCancel = (message, you) => {
  let failureDescription = ''
  let allowCancelRetry = false
  let resolveByEdit = false
  if ((message.type === 'text' || message.type === 'attachment') && message.errorReason) {
    failureDescription = message.errorReason
    if (you && ['pending', 'failed'].includes(message.submitState)) {
      // This is a message still in the outbox, we can retry/edit to fix, but
      // for flip messages, don't allow retry/cancel
      allowCancelRetry = message.type === 'attachment' || !message.flipGameID
      const messageType = message.type === 'attachment' ? 'attachment' : 'message'
      failureDescription = `This ${messageType} failed to send`
      resolveByEdit = !!message.outboxID && !!you && message.errorReason === 'message is too long'
      if (resolveByEdit) {
        failureDescription += `, ${message.errorReason}`
      }
    }
  }
  return {allowCancelRetry, failureDescription, resolveByEdit}
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
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const {previous, message, _you} = stateProps
    let showUsername = getUsernameToShow(message, previous, _you, stateProps.orangeLineAbove)
    // TODO type guard
    const outboxID: Types.OutboxID | null = (message as any).outboxID || null
    let {allowCancelRetry, resolveByEdit, failureDescription} = getFailureDescriptionAllowCancel(
      message,
      _you
    )

    // show send only if its possible we sent while you're looking at it
    const showSendIndicator = _you === message.author && message.ordinal !== message.id
    const decorate = getDecorate(message)
    const onCancel = allowCancelRetry
      ? () => dispatchProps._onCancel(message.conversationIDKey, message.ordinal)
      : undefined
    const onRetry =
      allowCancelRetry && !resolveByEdit && outboxID
        ? () => dispatchProps._onRetry(message.conversationIDKey, outboxID)
        : undefined

    // TODO type guard
    const forceAsh = !!(message as any).explodingUnreadable

    return {
      authorIsAdmin: stateProps.authorIsAdmin,
      authorIsOwner: stateProps.authorIsOwner,
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
    }
  },
  'WrapperMessage'
)(WrapperMessage)
