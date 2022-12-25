import * as React from 'react'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as WalletConstants from '../../../../constants/wallets'
import TextMessage, {type ReplyProps} from '.'
import shallowEqual from 'shallowequal'
import type * as Types from '../../../../constants/types/chat2'

type OwnProps = {
  isHighlighted?: boolean
  message: Types.MessageText
}

const replyNoop = () => {}

const getReplyProps = (
  replyTo: Types.Message | undefined,
  onReplyClick: (m: Types.MessageID) => void
): ReplyProps | undefined => {
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
            edited: !!replyTo.hasBeenEdited,
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

const getClaimProps = (state: Container.TypedState, message: Types.MessageText) => {
  const paymentInfo = Constants.getPaymentMessageInfo(state, message)
  if (!paymentInfo) {
    return undefined
  }

  const youAreSender = message.author === state.config.username
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
  // TODO dont return this object
  return {amount, label}
}

const TextMessageContainer = React.memo(function TextMessageContainer(p: OwnProps) {
  const {message, isHighlighted} = p
  const {conversationIDKey, ordinal, decoratedText, text, errorReason, replyTo} = message
  const isEditing = Container.useSelector(state => {
    const editInfo = Constants.getEditInfo(state, conversationIDKey)
    return !!(editInfo && editInfo.ordinal === ordinal)
  })
  const claim = Container.useSelector(state => getClaimProps(state, message), shallowEqual)
  const dispatch = Container.useDispatch()
  const onClaim = React.useCallback(() => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['walletOnboarding']}))
  }, [dispatch])
  const onReplyClick = React.useCallback(
    (messageID: Types.MessageID) => {
      dispatch(Chat2Gen.createReplyJump({conversationIDKey, messageID}))
    },
    [dispatch, conversationIDKey]
  )

  const props = {
    claim: claim ? {onClaim, ...claim} : undefined,
    isEditing,
    isHighlighted,
    message: message,
    reply: getReplyProps(replyTo || undefined, onReplyClick),
    text: decoratedText ? decoratedText.stringValue() : text.stringValue(),
    type: errorReason ? ('error' as const) : !message.submitState ? ('sent' as const) : ('pending' as const),
  }

  return <TextMessage {...props} />
})

export default TextMessageContainer
