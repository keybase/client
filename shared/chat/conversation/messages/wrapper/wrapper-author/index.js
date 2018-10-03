// @flow
import * as React from 'react'
import * as Types from '../../../../../constants/types/chat2'
import * as Styles from '../../../../../styles'
import {Avatar, Text, Box} from '../../../../../common-adapters'
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
  return isFollowing ? Styles.globalColors.green2 : Styles.globalColors.blue
}

const UserAvatar = ({author, onAuthorClick}) => (
  <Box style={styles.userAvatar}>
    <Avatar size={32} username={author} skipBackground={true} onClick={onAuthorClick} />
  </Box>
)

const Username = ({username, isYou, isFollowing, isBroken, onClick}) => {
  const style = Styles.collapseStyles([
    Styles.desktopStyles.clickable,
    styles.username,
    isYou && styles.usernameYou,
    {color: colorForAuthor(username, isYou, isFollowing, isBroken)},
  ])
  return (
    <Text
      type="BodySmallSemibold"
      onClick={onClick}
      className="hover-underline"
      selectable={true}
      style={style}
    >
      {username}
    </Text>
  )
}

const EditedMark = () => (
  <Text type="BodyTiny" style={styles.edited}>
    EDITED
  </Text>
)

const Failure = ({failureDescription, isExplodingUnreadable, onEdit, onRetry, onCancel}) => {
  const error = `${failureDescription}. `
  const resolveByEdit = failureDescription === 'Failed to send: message is too long'
  return isExplodingUnreadable ? (
    <Text type="BodySmall" style={styles.fail}>
      This exploding message is not available to you.
    </Text>
  ) : (
    <Text type="BodySmall">
      <Text type="BodySmall" style={styles.fail}>
        {error}
      </Text>
      {!!onCancel && (
        <Text type="BodySmall" style={styles.failStyleUnderline} onClick={onCancel}>
          Cancel
        </Text>
      )}
      {!!onCancel && <Text type="BodySmall"> or </Text>}
      {!!onEdit &&
        resolveByEdit && (
          <Text type="BodySmall" style={styles.failStyleUnderline} onClick={onEdit}>
            Edit
          </Text>
        )}
      {!!onRetry &&
        !resolveByEdit && (
          <Text type="BodySmall" style={styles.failStyleUnderline} onClick={onRetry}>
            Retry
          </Text>
        )}
    </Text>
  )
}

const LeftSide = props => (
  <Box style={styles.leftSide}>
    {props.includeHeader && (
      <Box style={styles.hasHeader}>
        <UserAvatar author={props.author} onAuthorClick={props.onAuthorClick} />
      </Box>
    )}
  </Box>
)

const RightSide = props => {
  const content = (
    <>
      {props.message.type === 'text' && <TextMessage message={props.message} isEditing={props.isEditing} />}
      {props.message.type === 'attachment' && (
        <AttachmentMessage message={props.message} toggleMessageMenu={props.toggleMessageMenu} />
      )}
      {(props.message.type === 'sendPayment' || props.message.type === 'requestPayment') && (
        <PaymentMessage message={props.message} />
      )}
      {props.isEdited && <EditedMark />}
    </>
  )
  return (
    <Box style={styles.rightSideContainer}>
      <Box
        style={Styles.collapseStyles([styles.rightSide, props.includeHeader && styles.hasHeader])}
        className="message-wrapper"
      >
        {props.includeHeader && (
          <Username
            username={props.author}
            isYou={props.isYou}
            isFollowing={props.isFollowing}
            isBroken={props.isBroken}
            onClick={props.onAuthorClick}
          />
        )}
        <Box style={styles.textContainer} className="message">
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
        </Box>
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
        <Box style={styles.sendIndicator}>
          {props.isYou && (
            <SendIndicator
              sent={props.messageSent || props.exploded}
              failed={props.messageFailed}
              id={props.timestamp}
            />
          )}
        </Box>
      </Box>
    </Box>
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
      <Box style={Styles.collapseStyles([styles.flexOneRow, this.props.includeHeader && styles.hasHeader])}>
        {LeftSide(this.props)}
        {RightSide(this.props)}
      </Box>
    )
  }
}

const styles = Styles.styleSheetCreate({
  edited: {color: Styles.globalColors.black_20},
  fail: {color: Styles.globalColors.red},
  failStyleUnderline: {color: Styles.globalColors.red, textDecorationLine: 'underline'},
  flexOneColumn: {...Styles.globalStyles.flexBoxColumn, flex: 1},
  flexOneRow: {...Styles.globalStyles.flexBoxRow, flex: 1},
  hasHeader: {paddingTop: Styles.globalMargins.xtiny},
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
    paddingRight: Styles.globalMargins.tiny,
    position: 'relative',
  },
  rightSideContainer: {
    ...Styles.globalStyles.flexBoxRow,
    flex: 1,
    paddingBottom: 2,
    paddingRight: Styles.globalMargins.tiny,
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
      right: -14,
      top: 2,
    },
  }),
  textContainer: {
    ...Styles.globalStyles.flexBoxRow,
    borderRadius: 4,
    flex: 1,
  },
  userAvatar: {
    flexShrink: 0,
    height: 32,
    width: 32,
  },
  username: {
    alignSelf: 'flex-start',
    marginBottom: 0,
  },
})

export default WrapperAuthor
