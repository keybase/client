// @flow
import * as React from 'react'
import {Avatar, Icon, Text, Box, iconCastPlatformStyles} from '../../../../common-adapters'
import {type FloatingMenuParentProps} from '../../../../common-adapters/floating-menu'
import {
  globalStyles,
  globalMargins,
  globalColors,
  isMobile,
  styleSheetCreate,
  collapseStyles,
} from '../../../../styles'
import Timestamp from './timestamp'
import SendIndicator from './chat-send'
import MessagePopup from '../message-popup'
import HeightRetainer from './height-retainer'

import type {Props} from '.'

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
    styles.username,
    isYou && styles.usernameYou,
    {color: colorForAuthor(username, isYou, isFollowing, isBroken)},
  ])
  return (
    <Text type="BodySmallSemibold" onClick={onClick} className="hover-underline" style={style}>
      {username}
    </Text>
  )
}

const MenuButton = ({onClick, setRef}) => (
  <Box ref={setRef} className="menu-button">
    <Icon
      type="iconfont-ellipsis"
      style={iconCastPlatformStyles(styles.ellipsis)}
      onClick={onClick}
      fontSize={16}
    />
  </Box>
)

const EditedMark = () => (
  <Text type="BodySmall" style={styles.edited}>
    EDITED
  </Text>
)

const Failure = ({failureDescription, onEdit, onRetry, onCancel}) => {
  const error = `${failureDescription}. `
  const resolveByEdit = failureDescription === 'Failed to send: message is too long'
  return (
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
    <Box style={styles.sendIndicatorContainer}>
      {props.isYou && (
        <SendIndicator
          sent={props.messageSent}
          failed={props.messageFailed}
          style={{marginBottom: 2}}
          id={props.message.timestamp}
        />
      )}
    </Box>
    {/* The avatar is above this actually but we want the send indicator to never be a part of the height
    calculation so we put it first so it appears under the avatar if they overlap */}
    {props.includeHeader && <UserAvatar author={props.author} onAuthorClick={props.onAuthorClick} />}
  </Box>
)

const RightSide = props => (
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
      <HeightRetainer style={styles.flexOneColumn} retainHeight={props.message.exploded}>
        <props.innerClass
          message={props.message}
          isEditing={props.isEditing}
          toggleShowingMenu={props.toggleShowingMenu}
        />
        {props.isEdited && <EditedMark />}
      </HeightRetainer>
      {!isMobile && <MenuButton setRef={props.setAttachmentRef} onClick={props.toggleShowingMenu} />}
      <MessagePopup
        attachTo={props.attachmentRef}
        message={props.message}
        onHidden={props.toggleShowingMenu}
        position="bottom left"
        visible={props.showingMenu}
      />
      {props.isRevoked && (
        <Icon
          type="iconfont-exclamation"
          style={iconCastPlatformStyles(styles.exclamation)}
          color={globalColors.blue}
          fontSize={11}
        />
      )}
    </Box>
    {!!props.failureDescription && (
      <Failure
        failureDescription={props.failureDescription}
        onRetry={props.onRetry}
        onEdit={props.onEdit}
        onCancel={props.onCancel}
      />
    )}
  </Box>
)

class MessageWrapper extends React.PureComponent<Props & FloatingMenuParentProps> {
  render() {
    const props = this.props
    return (
      <Box style={styles.container}>
        {props.orangeLineAbove && <Box style={styles.orangeLine} />}
        {props.timestamp && <Timestamp timestamp={props.timestamp} />}
        <Box
          style={collapseStyles([
            styles.leftRightContainer,
            props.showingMenu && styles.selected,
            props.includeHeader && styles.hasHeader,
          ])}
        >
          <LeftSide {...props} />
          <RightSide {...props} />
        </Box>
      </Box>
    )
  }
}

const styles = styleSheetCreate({
  container: {...globalStyles.flexBoxColumn, width: '100%'},
  edited: {backgroundColor: globalColors.white, color: globalColors.black_20_on_white},
  ellipsis: {marginLeft: globalMargins.tiny, marginRight: globalMargins.xtiny},
  exclamation: {
    paddingBottom: globalMargins.xtiny,
    paddingTop: globalMargins.xtiny,
  },
  fail: {color: globalColors.red},
  failStyleUnderline: {color: globalColors.red, textDecorationLine: 'underline'},
  flexOneColumn: {...globalStyles.flexBoxColumn, flex: 1},
  flexOneRow: {...globalStyles.flexBoxRow, flex: 1},
  hasHeader: {paddingTop: 6},
  leftRightContainer: {...globalStyles.flexBoxRow, width: '100%'},
  leftSide: {flexShrink: 0, marginLeft: 8, marginRight: 8, position: 'relative', width: 32},
  orangeLine: {backgroundColor: globalColors.orange, height: 1, width: '100%'},
  rightSide: {
    ...globalStyles.flexBoxColumn,
    paddingBottom: 2,
    paddingRight: globalMargins.tiny,
    width: '100%',
  },
  selected: {backgroundColor: globalColors.black_05},
  sendIndicatorContainer: {
    // we never want this thing to push content around
    alignItems: 'flex-start',
    bottom: 0,
    height: 21,
    justifyContent: 'flex-end',
    position: 'absolute',
    right: 0,
    width: 32,
  },
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
    backgroundColor: globalColors.fastBlank,
    marginBottom: 0,
  },
  usernameYou: {
    ...globalStyles.italic,
  },
})

export default MessageWrapper
