import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Styles from '../../../../styles'
import * as WalletConstants from '../../../../constants/wallets'
import shallowEqual from 'shallowequal'
import type * as Types from '../../../../constants/types/chat2'
import type CoinFlipType from './coinflip/container'
import type UnfurlListType from './unfurl/unfurl-list/container'
import type UnfurlPromptListType from './unfurl/prompt-list/container'
import {ConvoIDContext} from '../ids-context'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import {sharedStyles} from '../shared-styles'

type BProps = {
  showCenteredHighlight: boolean
  hasBeenEdited: boolean
  hasUnfurlPrompts: boolean
  hasUnfurlList: boolean
  hasCoinFlip: boolean
  toggleShowingPopup: () => void
  measure: (() => void) | undefined
}
const WrapperTextBottom = React.memo(function WrapperTextBottom(p: BProps) {
  const {hasBeenEdited, hasUnfurlPrompts, hasUnfurlList, hasCoinFlip} = p
  const {toggleShowingPopup, measure, showCenteredHighlight} = p
  const edited = hasBeenEdited ? (
    <Kb.Text
      key="isEdited"
      type="BodyTiny"
      style={showCenteredHighlight ? styles.editedHighlighted : styles.edited}
    >
      EDITED
    </Kb.Text>
  ) : null

  const unfurlPrompts = (() => {
    if (hasUnfurlPrompts) {
      const UnfurlPromptList = require('./unfurl/prompt-list/container')
        .default as typeof UnfurlPromptListType
      return <UnfurlPromptList />
    }
    return null
  })()

  const unfurlList = (() => {
    const UnfurlList = require('./unfurl/unfurl-list/container').default as typeof UnfurlListType
    if (hasUnfurlList) {
      return <UnfurlList key="UnfurlList" toggleMessagePopup={toggleShowingPopup} />
    }
    return null
  })()

  const coinflip = (() => {
    if (hasCoinFlip) {
      const CoinFlip = require('./coinflip/container').default as typeof CoinFlipType
      return <CoinFlip key="CoinFlip" measure={measure} />
    }
    return null
  })()

  return (
    <>
      {edited}
      {unfurlPrompts}
      {unfurlList}
      {coinflip}
    </>
  )
})

const replyNoop = () => {}

export type ReplyProps = {
  deleted: boolean
  edited: boolean
  imageHeight?: number
  imageURL?: string
  imageWidth?: number
  isParentHighlighted?: boolean
  onClick: () => void
  text: string
  username: string
}
const Reply = (props: ReplyProps) => {
  const [imageLoaded, setImageLoaded] = React.useState(false)
  const sizing =
    props.imageWidth && props.imageHeight
      ? Constants.zoomImage(props.imageWidth, props.imageHeight, 80)
      : undefined
  return (
    <Kb.ClickableBox onClick={props.onClick}>
      <Kb.Box2
        direction="horizontal"
        gap="tiny"
        fullWidth={true}
        style={styles.replyContainer}
        className={Styles.classNames('ReplyBox')}
      >
        <Kb.Box2 direction="horizontal" style={styles.quoteContainer} />
        <Kb.Box2 direction="vertical" gap="xtiny" style={styles.replyContentContainer}>
          <Kb.Box2 direction="horizontal" fullWidth={true}>
            <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true}>
              <Kb.Avatar username={props.username} size={16} />
              <Kb.Text
                type="BodySmallBold"
                style={Styles.collapseStyles([
                  styles.replyUsername,
                  props.isParentHighlighted && styles.replyUsernameHighlighted,
                ])}
              >
                {props.username}
              </Kb.Text>
            </Kb.Box2>
          </Kb.Box2>
          <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
            {!!props.imageURL && (
              <Kb.Box2 direction="vertical" style={styles.replyImageContainer}>
                <Kb.Box style={{...(sizing ? sizing.margins : {})}}>
                  <Kb.Image
                    src={props.imageURL}
                    onLoad={() => setImageLoaded(true)}
                    style={{...(sizing ? sizing.dims : {})}}
                  />
                  {!imageLoaded && <Kb.ProgressIndicator style={styles.replyProgress} />}
                </Kb.Box>
              </Kb.Box2>
            )}
            <Kb.Box2 direction="horizontal" style={styles.replyTextContainer}>
              {!props.deleted ? (
                <Kb.Text
                  type="BodySmall"
                  style={Styles.collapseStyles([props.isParentHighlighted && styles.textHighlighted])}
                  lineClamp={3}
                >
                  {props.text}
                </Kb.Text>
              ) : (
                <Kb.Text type="BodyTiny" style={styles.replyEdited}>
                  The original message was deleted.
                </Kb.Text>
              )}
            </Kb.Box2>
          </Kb.Box2>
          {props.edited && (
            <Kb.Text type="BodyTiny" style={styles.replyEdited}>
              EDITED
            </Kb.Text>
          )}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}
const useGetReplyProps = (
  replyTo: Types.Message | undefined,
  conversationIDKey: Types.ConversationIDKey
): ReplyProps | undefined => {
  const dispatch = Container.useDispatch()

  const replyToId = replyTo?.id

  const onReplyClick = React.useCallback(() => {
    replyToId && dispatch(Chat2Gen.createReplyJump({conversationIDKey, messageID: replyToId}))
  }, [dispatch, conversationIDKey, replyToId])

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
            onClick: onReplyClick,
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

export type ClaimProps = {
  amount: string
  label: string
  onClaim: () => void
}

const Claim = (props: ClaimProps) => {
  return (
    <Kb.Button type="Wallet" onClick={props.onClaim} small={true} style={styles.claimButton}>
      <Kb.Text style={styles.claimLabel} type="BodySemibold">
        {props.label}{' '}
        <Kb.Text style={styles.claimLabel} type="BodyExtrabold">
          {props.amount}
        </Kb.Text>
      </Kb.Text>
    </Kb.Button>
  )
}

// Encoding all 4 states as static objects so we don't re-render
const getStyle = (type: 'error' | 'sent' | 'pending', isEditing: boolean, isHighlighted?: boolean) => {
  if (isHighlighted) {
    return Styles.collapseStyles([sharedStyles.sent, sharedStyles.highlighted])
  } else if (type === 'sent') {
    return isEditing
      ? sharedStyles.sentEditing
      : Styles.collapseStyles([sharedStyles.sent, Styles.globalStyles.fastBackground])
  } else {
    return isEditing
      ? sharedStyles.pendingFailEditing
      : Styles.collapseStyles([sharedStyles.pendingFail, Styles.globalStyles.fastBackground])
  }
}

const WrapperText = React.memo(function WrapperText(p: Props) {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const {ordinal, measure} = p
  const common = useCommon(ordinal)
  const {showCenteredHighlight, toggleShowingPopup} = common

  const {hasBeenEdited, hasUnfurlPrompts, hasCoinFlip, hasUnfurlList} = Container.useSelector(state => {
    const message = state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)
    const hasCoinFlip = message?.type === 'text' && !!message.flipGameID
    const hasUnfurlList = message?.type === 'text' && (message.unfurls.size ?? 0) > 0

    const id = message?.id
    const hasUnfurlPrompts = id
      ? (state.chat2.unfurlPromptMap.get(conversationIDKey)?.get(id)?.size ?? 0) > 0
      : false
    const hasBeenEdited = message?.hasBeenEdited ?? false
    return {hasBeenEdited, hasCoinFlip, hasUnfurlList, hasUnfurlPrompts}
  }, shallowEqual)

  const bottomChildren = (
    <WrapperTextBottom
      hasBeenEdited={hasBeenEdited}
      hasCoinFlip={hasCoinFlip}
      hasUnfurlList={hasUnfurlList}
      hasUnfurlPrompts={hasUnfurlPrompts}
      measure={measure}
      showCenteredHighlight={showCenteredHighlight}
      toggleShowingPopup={toggleShowingPopup}
    />
  )

  const replyTo = Container.useSelector(state => {
    const m = state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)
    const replyTo = m?.replyTo
    return replyTo
  }, shallowEqual)

  const replyProps = useGetReplyProps(replyTo || undefined, conversationIDKey)
  const reply = React.useMemo(
    () => (replyProps ? <Reply {...replyProps} isParentHighlighted={showCenteredHighlight} /> : null),
    [replyProps, showCenteredHighlight]
  )

  const claimProps = Container.useSelector(state => {
    const m = state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)
    return m?.type === 'text' ? getClaimProps(state, m) : undefined
  }, shallowEqual)
  const dispatch = Container.useDispatch()
  const onClaim = React.useCallback(() => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['walletOnboarding']}))
  }, [dispatch])
  const claim = React.useMemo(
    () => (claimProps ? <Claim {...claimProps} onClaim={onClaim} /> : null),
    [claimProps, onClaim]
  )

  const isEditing = Container.useSelector(state => {
    const editInfo = Constants.getEditInfo(state, conversationIDKey)
    return !!(editInfo && editInfo.ordinal === ordinal)
  })

  const text = Container.useSelector(state => {
    const m = state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)
    if (m?.type !== 'text') return ''
    const decoratedText = m.decoratedText
    const text = m.text
    return decoratedText ? decoratedText.stringValue() : text ? text.stringValue() : ''
  })

  const type = Container.useSelector(state => {
    const m = state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)
    const errorReason = m?.errorReason
    return errorReason ? ('error' as const) : !m?.submitState ? ('sent' as const) : ('pending' as const)
  })

  const style = React.useMemo(
    () => getStyle(type, isEditing, showCenteredHighlight),
    [type, isEditing, showCenteredHighlight]
  )
  const styleOverride = React.useMemo(
    () => (Styles.isMobile ? {paragraph: getStyle(type, isEditing, showCenteredHighlight)} : undefined),
    [type, isEditing, showCenteredHighlight]
  )

  return (
    <WrapperMessage {...p} {...common} bottomChildren={bottomChildren}>
      {reply}
      <Kb.Markdown style={style} messageType="text" styleOverride={styleOverride} allowFontScaling={true}>
        {text}
      </Kb.Markdown>
      {claim}
    </WrapperMessage>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      claimButton: {
        alignSelf: 'flex-start',
        marginTop: Styles.globalMargins.xtiny,
      },
      claimLabel: {color: Styles.globalColors.white},
      edited: {color: Styles.globalColors.black_20},
      editedHighlighted: {color: Styles.globalColors.black_20OrBlack},
      quoteContainer: {
        alignSelf: 'stretch',
        backgroundColor: Styles.globalColors.grey,
        paddingLeft: Styles.globalMargins.xtiny,
      },
      replyContainer: {paddingTop: Styles.globalMargins.xtiny},
      replyContentContainer: {flex: 1},
      replyEdited: {color: Styles.globalColors.black_35},
      replyImageContainer: {
        overflow: 'hidden',
        position: 'relative',
      },
      replyProgress: {
        bottom: '50%',
        left: '50%',
        marginBottom: -12,
        marginLeft: -12,
        marginRight: -12,
        marginTop: -12,
        position: 'absolute',
        right: '50%',
        top: '50%',
        width: 24,
      },
      replyTextContainer: {
        alignSelf: 'flex-start',
        flex: 1,
      },
      replyUsername: {alignSelf: 'center'},
      replyUsernameHighlighted: {color: Styles.globalColors.blackOrBlack},
      textHighlighted: {color: Styles.globalColors.black_50OrBlack_50},
    } as const)
)

export default WrapperText
