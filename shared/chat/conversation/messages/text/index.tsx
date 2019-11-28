import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

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
              <Kb.Avatar username={props.username} size={32} />
              <Kb.Text
                type="BodySemibold"
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

export type ClaimProps = {
  amount: number
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

export type Props = {
  claim?: ClaimProps
  isEditing: boolean
  isHighlighted?: boolean
  // eslint-disable-next-line
  message: Types.MessageText
  reply?: ReplyProps
  text: string
  type: 'error' | 'pending' | 'sent'
}

const MessageText = ({claim, isEditing, isHighlighted, message, reply, text, type}: Props) => {
  const markdown = (
    <Kb.Markdown
      style={getStyle(type, isEditing, isHighlighted)}
      meta={{message}}
      styleOverride={Styles.isMobile ? {paragraph: getStyle(type, isEditing, isHighlighted)} : undefined}
      allowFontScaling={true}
    >
      {text}
    </Kb.Markdown>
  )
  const content = (
    <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true}>
      {!!reply && <Reply {...reply} isParentHighlighted={isHighlighted} />}
      {markdown}
      {!!claim && <Claim {...claim} />}
    </Kb.Box2>
  )

  return Styles.isMobile ? (
    <Kb.Box2 direction="vertical" style={styles.wrapper} fullWidth={true}>
      {content}
    </Kb.Box2>
  ) : (
    content
  )
}

// Encoding all 4 states as static objects so we don't re-render
const getStyle = (type: Props['type'], isEditing: boolean, isHighlighted?: boolean) => {
  if (isHighlighted) {
    return Styles.collapseStyles([styles.sent, styles.highlighted])
  } else if (type === 'sent') {
    return isEditing ? styles.sentEditing : styles.sent
  } else {
    return isEditing ? styles.pendingFailEditing : styles.pendingFail
  }
}

const editing = {
  backgroundColor: Styles.globalColors.yellowLight,
  borderRadius: 2,
  color: Styles.globalColors.blackOrBlack,
  paddingLeft: Styles.globalMargins.tiny,
  paddingRight: Styles.globalMargins.tiny,
}
const sent = Styles.platformStyles({
  isElectron: {
    // Make text selectable. On mobile we implement that differently.
    cursor: 'text',
    userSelect: 'text',
    whiteSpace: 'pre-wrap',
    width: '100%',
    wordBreak: 'break-word',
  } as const,
  isMobile: {
    ...Styles.globalStyles.flexBoxColumn,
  },
})
const sentEditing = {
  ...sent,
  ...editing,
}
const pendingFail = {
  ...sent,
}
const pendingFailEditing = {
  ...pendingFail,
  ...editing,
}
const styles = Styles.styleSheetCreate(
  () =>
    ({
      claimButton: {
        alignSelf: 'flex-start',
        marginTop: Styles.globalMargins.xtiny,
      },
      claimLabel: {
        color: Styles.globalColors.white,
      },
      editing,
      highlighted: {
        color: Styles.globalColors.blackOrBlack,
      },
      pendingFail,
      pendingFailEditing,
      quoteContainer: {
        alignSelf: 'stretch',
        backgroundColor: Styles.globalColors.grey,
        paddingLeft: Styles.globalMargins.xtiny,
      },
      replyContainer: {
        paddingTop: Styles.globalMargins.xtiny,
      },
      replyContentContainer: {
        flex: 1,
      },
      replyEdited: {
        color: Styles.globalColors.black_35,
      },
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
      replyUsername: {
        alignSelf: 'center',
      },
      replyUsernameHighlighted: {
        color: Styles.globalColors.blackOrBlack,
      },
      sent,
      sentEditing,
      textHighlighted: {
        color: Styles.globalColors.black_50OrBlack_50,
      },
      wrapper: {alignSelf: 'flex-start', flex: 1},
    } as const)
)

export default MessageText
