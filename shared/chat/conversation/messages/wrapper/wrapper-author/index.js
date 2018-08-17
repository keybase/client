// @flow
import * as React from 'react'
import * as Types from '../../../../../constants/types/chat2'
import {Avatar, Icon, Text, Box, iconCastPlatformStyles} from '../../../../../common-adapters'
import {
  desktopStyles,
  globalStyles,
  globalMargins,
  globalColors,
  platformStyles,
  styleSheetCreate,
  collapseStyles,
  type StylesCrossPlatform,
} from '../../../../../styles'
import TextMessage from '../../text/container'
import AttachmentMessage from '../../attachment/container'
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
  isRevoked: boolean,
  isYou: boolean,
  measure: null | (() => void),
  message: Types.MessageText | Types.MessageAttachment,
  messageFailed: boolean,
  messageKey: string,
  messagePending: boolean,
  messageSent: boolean,
  onRetry: null | (() => void),
  onEdit: null | (() => void),
  onCancel: null | (() => void),
  onAuthorClick: () => void,
  orangeLineAbove: boolean,
  ordinal: Types.Ordinal,
  styles: StylesCrossPlatform,
  timestamp: number,
  toggleMessageMenu: () => void,
  type: 'text' | 'attachment',
|}

const colorForAuthor = (user: string, isYou: boolean, isFollowing: boolean, isBroken: boolean) => {
  if (isYou) {
    return globalColors.black_75
  }

  if (isBroken) {
    return globalColors.red
  }
  return isFollowing ? globalColors.green2 : globalColors.blue
}

const UserAvatar = ({author, onAuthorClick}) => (
  <Box style={styles.userAvatar}>
    <Avatar size={32} username={author} skipBackground={true} onClick={onAuthorClick} />
  </Box>
)

const Username = ({username, isYou, isFollowing, isBroken, onClick}) => {
  const style = collapseStyles([
    desktopStyles.clickable,
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
    {props.includeHeader && <UserAvatar author={props.author} onAuthorClick={props.onAuthorClick} />}
  </Box>
)

const RightSide = props => (
  <Box style={styles.rightSideContainer}>
    <Box
      style={collapseStyles([styles.rightSide, props.includeHeader && styles.hasHeader])}
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
        <ExplodingHeightRetainer
          explodedBy={props.explodedBy}
          exploding={props.exploding}
          measure={props.measure}
          messageKey={props.messageKey}
          style={styles.flexOneColumn}
          retainHeight={props.exploded || props.isExplodingUnreadable}
        >
          {/* Additional checks on `props.message.type` here to satisfy flow */}
          {props.type === 'text' &&
            props.message.type === 'text' && (
              <TextMessage message={props.message} isEditing={props.isEditing} />
            )}
          {props.type === 'attachment' &&
            props.message.type === 'attachment' && (
              <AttachmentMessage message={props.message} toggleMessageMenu={props.toggleMessageMenu} />
            )}
          {props.isEdited && <EditedMark />}
        </ExplodingHeightRetainer>
        {props.isRevoked && (
          <Icon
            type="iconfont-exclamation"
            style={iconCastPlatformStyles(styles.exclamation)}
            color={globalColors.blue}
            fontSize={14}
          />
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

class WrapperAuthor extends React.PureComponent<Props> {
  componentDidUpdate(prevProps: Props) {
    if (this.props.measure) {
      if (this.props.includeHeader !== prevProps.includeHeader) {
        this.props.measure()
      }
    }
  }

  render() {
    const props = this.props
    return (
      <Box style={collapseStyles([styles.flexOneRow, props.includeHeader && styles.hasHeader])}>
        <LeftSide {...props} />
        <RightSide {...props} />
      </Box>
    )
  }
}

const styles = styleSheetCreate({
  edited: {color: globalColors.black_20},
  exclamation: {
    paddingBottom: globalMargins.xtiny,
    paddingTop: globalMargins.xtiny,
  },
  fail: {color: globalColors.red},
  failStyleUnderline: {color: globalColors.red, textDecorationLine: 'underline'},
  flexOneColumn: {...globalStyles.flexBoxColumn, flex: 1},
  flexOneRow: {...globalStyles.flexBoxRow, flex: 1},
  hasHeader: {paddingTop: 6},
  leftSide: platformStyles({
    common: {
      flexShrink: 0,
      marginRight: globalMargins.tiny,
      position: 'relative',
      width: 32,
    },
    isElectron: {
      marginLeft: globalMargins.small,
    },
    isMobile: {
      marginLeft: globalMargins.tiny,
    },
  }),
  rightSide: {
    ...globalStyles.flexBoxColumn,
    flex: 1,
    paddingRight: globalMargins.tiny,
    position: 'relative',
  },
  rightSideContainer: {
    ...globalStyles.flexBoxRow,
    flex: 1,
    paddingBottom: 2,
    paddingRight: globalMargins.tiny,
  },
  sendIndicator: platformStyles({
    common: {
      ...globalStyles.flexBoxRow,
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
    ...globalStyles.flexBoxRow,
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
  usernameYou: {
    ...globalStyles.italic,
  },
})

export default WrapperAuthor
