import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import TextMessage, {Props, ClaimProps} from '.'
import * as Container from '../../../../util/container'
import * as WalletConstants from '../../../../constants/wallets'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'

type OwnProps = {
  message: Types.MessageText
}

const replyNoop = () => {}

const getReplyProps = (replyTo: Types.Message | undefined, onReplyClick: (m: Types.MessageID) => void) => {
  if (!replyTo) {
    return undefined
  }
  const deletedProps = {
    deleted: true,
    edited: false,
    onClick: replyNoop,
    text: '',
    username: '',
  }
  switch (replyTo.type) {
    case 'attachment':
    case 'text': {
      const attachment: Types.MessageAttachment | undefined =
        replyTo.type === 'attachment' && replyTo.attachmentType === 'image' ? replyTo : undefined
      return replyTo.exploded
        ? deletedProps
        : {
            deleted: false,
            edited: replyTo.hasBeenEdited,
            imageHeight: attachment ? attachment.previewHeight : undefined,
            imageURL: attachment ? attachment.previewURL : undefined,
            imageWidth: attachment ? attachment.previewWidth : undefined,
            onClick: () => onReplyClick(replyTo.id),
            text:
              replyTo.type === 'attachment'
                ? replyTo.title || (replyTo.attachmentType === 'image' ? '' : replyTo.fileName)
                : replyTo.text.stringValue(),
            username: replyTo.author,
          }
    }
    case 'deleted':
    case 'placeholder':
      return deletedProps
  }
  return undefined
}

const getClaimProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const paymentInfo = Constants.getPaymentMessageInfo(state, ownProps.message)
  if (!paymentInfo) {
    return undefined
  }

  const youAreSender = ownProps.message.author === state.config.username
  const cancelable = paymentInfo.status === 'claimable'
  const acceptedDisclaimer = WalletConstants.getAcceptedDisclaimer(state)
  if (youAreSender || !cancelable || acceptedDisclaimer) {
    return undefined
  }
  const label = `Claim${paymentInfo.worth ? ' Lumens worth' : ''}`
  const amountDescription = paymentInfo.sourceAmount
    ? `${paymentInfo.amountDescription}/${paymentInfo.issuerDescription}`
    : paymentInfo.amountDescription
  const amount = paymentInfo.worth ? paymentInfo.worth : amountDescription
  return {amount, label}
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const editInfo = Constants.getEditInfo(state, ownProps.message.conversationIDKey)
  const isEditing = !!(editInfo && editInfo.ordinal === ownProps.message.ordinal)
  const claim = getClaimProps(state, ownProps)
  return {claim, isEditing}
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch, {message}: OwnProps) => ({
  _onClaim: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['walletOnboarding']})),
  _onReplyClick: (messageID: Types.MessageID) =>
    dispatch(
      Chat2Gen.createReplyJump({
        conversationIDKey: message.conversationIDKey,
        messageID,
      })
    ),
})

const mergeClaimProps = (stateProps, dispatchProps): ClaimProps => {
  return stateProps.claim ? {onClaim: dispatchProps._onClaim, ...stateProps.claim} : undefined
}

type MsgType = Props['type']
export default Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    claim: mergeClaimProps(stateProps, dispatchProps),
    isEditing: stateProps.isEditing,
    message: ownProps.message,
    reply: getReplyProps(ownProps.message.replyTo || undefined, dispatchProps._onReplyClick),
    text: ownProps.message.decoratedText
      ? ownProps.message.decoratedText.stringValue()
      : ownProps.message.text.stringValue(),
    type: (ownProps.message.errorReason
      ? 'error'
      : ownProps.message.submitState === null
      ? 'sent'
      : 'pending') as MsgType,
  }),
  'TextMessage'
)(TextMessage)
