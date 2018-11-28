// @flow
import * as React from 'react'
import * as Types from '../../../../../constants/types/chat2'
import * as Styles from '../../../../../styles'
import * as Kb from '../../../../../common-adapters'
import {formatTimeForChat} from '../../../../../util/timestamp'
import TextMessage from '../../text/container'
import AttachmentMessage from '../../attachment/container'
import PaymentMessage from '../../account-payment/container'
import SendIndicator from '../chat-send'
import ExplodingHeightRetainer from '../exploding-height-retainer'

export type Props = {|
  author: string,
  conversationIDKey: Types.ConversationIDKey,
  exploded: boolean,
  explodedBy: string,
  explodesAt: number,
  exploding: boolean,
  failureDescription: string,
  includeHeader: boolean,
  isBroken: boolean,
  isEdited: boolean,
  isEditing: boolean,
  isExplodingUnreadable: boolean,
  isFollowing: boolean,
  isYou: boolean,
  measure: null | (() => void),
  message:
    | Types.MessageText
    | Types.MessageAttachment
    | Types.MessageSendPayment
    | Types.MessageRequestPayment,
  messageFailed: boolean,
  messageKey: string,
  messagePending: boolean,
  messageSent: boolean,
  onRetry: null | (() => void),
  onEdit: null | (() => void),
  onCancel: null | (() => void),
  onAuthorClick: () => void,
  ordinal: Types.Ordinal,
  timestamp: number,
  toggleMessageMenu: () => void,
|}

const colorForAuthor = (user: string, isYou: boolean, isFollowing: boolean, isBroken: boolean) => {
  if (isYou) {
    return Styles.globalColors.black_75
  }

  if (isBroken) {
    return Styles.globalColors.red
  }
  return isFollowing ? Styles.globalColors.green : Styles.globalColors.blue
}

const username = ({username, isYou, isFollowing, isBroken, onClick}) => {
  const style = Styles.collapseStyles([
    Styles.desktopStyles.clickable,
    {color: colorForAuthor(username, isYou, isFollowing, isBroken)},
  ])
  return (
    <Kb.Text
      type="BodySmallSemibold"
      onClick={onClick}
      className="hover-underline"
      selectable={true}
      style={style}
    >
      {username}
    </Kb.Text>
  )
}

const Failure = ({failureDescription, isExplodingUnreadable, onEdit, onRetry, onCancel}) => {
  const error = `${failureDescription}. `
  const resolveByEdit = failureDescription === 'Failed to send: message is too long'
  return isExplodingUnreadable ? (
    <Kb.Text type="BodySmall" style={styles.fail}>
      This exploding message is not available to you.
    </Kb.Text>
  ) : (
    <Kb.Text type="BodySmall">
      <Kb.Text type="BodySmall" style={styles.fail}>
        {error}
      </Kb.Text>
      {!!onCancel && (
        <Kb.Text type="BodySmall" style={styles.failStyleUnderline} onClick={onCancel}>
          Cancel
        </Kb.Text>
      )}
      {!!onCancel && <Kb.Text type="BodySmall"> or </Kb.Text>}
      {!!onEdit &&
        resolveByEdit && (
          <Kb.Text type="BodySmall" style={styles.failStyleUnderline} onClick={onEdit}>
            Edit
          </Kb.Text>
        )}
      {!!onRetry &&
        !resolveByEdit && (
          <Kb.Text type="BodySmall" style={styles.failStyleUnderline} onClick={onRetry}>
            Retry
          </Kb.Text>
        )}
    </Kb.Text>
  )
}

const rightSide = props => {
  const content = (
    <>
      {props.message.type === 'text' && <TextMessage message={props.message} isEditing={props.isEditing} />}
      {props.message.type === 'attachment' && (
        <AttachmentMessage message={props.message} toggleMessageMenu={props.toggleMessageMenu} />
      )}
      {(props.message.type === 'sendPayment' || props.message.type === 'requestPayment') && (
        <PaymentMessage message={props.message} />
      )}
      {props.isEdited && (
        <Kb.Text type="BodyTiny" style={styles.edited}>
          EDITED
        </Kb.Text>
      )}
    </>
  )
  return (
    <Kb.Box style={Styles.collapseStyles([styles.rightSide, props.includeHeader && styles.nameAndTimestamp])}>
      {props.includeHeader && (
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="xtiny" style={styles.usernameTimestamp}>
          {username({
            isBroken: props.isBroken,
            isFollowing: props.isFollowing,
            isYou: props.isYou,
            onClick: props.onAuthorClick,
            username: props.author,
          })}
          <Kb.Text type="BodyTiny">{formatTimeForChat(props.timestamp)}</Kb.Text>
        </Kb.Box2>
      )}
      <Kb.Box style={styles.textContainer} className="message">
        {/* TODO remove the `|| props.isExplodingUnreadable` when a fix for inadvertent error messages is in.
          The problem is that `isExplodingUnreadable` is coming as true without `props.exploded` sometimes.  */}
        {props.exploding ? (
          <ExplodingHeightRetainer
            explodedBy={props.explodedBy}
            exploding={props.exploding}
            measure={props.measure}
            messageKey={props.messageKey}
            style={styles.flexOneColumn}
            retainHeight={props.exploded || props.isExplodingUnreadable}
          >
            {content}
          </ExplodingHeightRetainer>
        ) : (
          content
        )}
      </Kb.Box>
      {!!props.failureDescription &&
        !props.exploded && (
          <Failure
            failureDescription={props.failureDescription}
            isExplodingUnreadable={props.isExplodingUnreadable}
            onRetry={props.onRetry}
            onEdit={props.onEdit}
            onCancel={props.onCancel}
          />
        )}
      <Kb.Box style={styles.sendIndicator}>
        {props.isYou && (
          <SendIndicator
            sent={props.messageSent || props.exploded}
            failed={props.messageFailed}
            id={props.timestamp}
          />
        )}
      </Kb.Box>
    </Kb.Box>
  )
}

class WrapperAuthor extends React.PureComponent<Props> {
  componentDidUpdate(prevProps: Props) {
    if (this.props.measure) {
      if (this.props.includeHeader !== prevProps.includeHeader) {
        this.props.measure()
      }
    }
  }

  render() {
    return (
      <Kb.Box2 direction="horizontal" fullWidth={true}>
        {this.props.includeHeader && (
          <Kb.Avatar
            size={32}
            username={this.props.author}
            skipBackground={true}
            onClick={this.props.onAuthorClick}
            style={styles.avatar}
          />
        )}
      </Kb.Box2>
    )
  }
}
// {leftSide(this.props)}
// {rightSide(this.props)}

const styles = Styles.styleSheetCreate({
  avatar: Styles.platformStyles({
    common: {
      marginTop: Styles.globalMargins.xtiny,
    },
    isElectron: {
      marginLeft: Styles.globalMargins.small,
    },
    isMobile: {
      // TODO
      marginLeft: 0,
    },
  }),
})

const OLDstyles = Styles.styleSheetCreate({
  edited: {color: Styles.globalColors.black_20},
  fail: {color: Styles.globalColors.red},
  failStyleUnderline: {color: Styles.globalColors.red, textDecorationLine: 'underline'},
  flexOneColumn: {...Styles.globalStyles.flexBoxColumn, flex: 1},
  flexOneRow: {...Styles.globalStyles.flexBoxRow, flex: 1},
  topPadding: {paddingTop: Styles.globalMargins.xtiny},
  nameAndTimestamp: Styles.platformStyles({
    isElectron: {paddingTop: 16},
  }),
  leftSide: Styles.platformStyles({
    common: {
      flexShrink: 0,
      marginRight: Styles.globalMargins.tiny,
      position: 'relative',
      width: 32,
    },
    isElectron: {
      marginLeft: Styles.globalMargins.small,
    },
    isMobile: {
      marginLeft: Styles.globalMargins.tiny,
    },
  }),
  rightSide: {
    ...Styles.globalStyles.flexBoxColumn,
    flex: 1,
    paddingBottom: 2,
    paddingRight: Styles.globalMargins.tiny,
    position: 'relative',
  },
  sendIndicator: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      height: 21,
      justifyContent: 'center',
      position: 'absolute',
      top: 2,
    },
    isElectron: {
      pointerEvents: 'none',
      right: 0,
      top: -1,
    },
    isMobile: {
      right: 0,
      top: 2,
    },
  }),
  textContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    borderRadius: 4,
    flex: 1,
  },
  userAvatar: {
    flexShrink: 0,
    height: 32,
    width: 32,
  },
  usernameTimestamp: {
    alignItems: 'baseline',
  },
})

export default WrapperAuthor
