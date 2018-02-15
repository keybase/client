// @flow
import * as React from 'react'
import {Avatar, Icon, Text, Box} from '../../../../common-adapters'
import {
  globalStyles,
  globalMargins,
  globalColors,
  isMobile,
  styleSheetCreate,
  collapseStyles,
} from '../../../../styles'
import ProfileResetNotice from '../system-profile-reset-notice/container'
import Timestamp from './timestamp'
import LoadMore from './load-more'

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

const UserAvatar = ({author, showImage, onAuthorClick}) => (
  <Box style={styles.userAvatar}>
    {showImage && <Avatar size={24} username={author} skipBackground={true} onClick={onAuthorClick} />}
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

const MenuButton = ({onClick}) => (
  <Box className="menu-button">
    <Icon type="iconfont-ellipsis" style={styles.ellipsis} onClick={onClick} />
  </Box>
)

const EditedMark = () => (
  <Text type="BodySmall" style={styles.edited}>
    EDITED
  </Text>
)

const Failure = ({failureDescription, onEdit, onRetry}) => {
  const error = `Failed to send${failureDescription ? ` -  ${failureDescription}` : ''}. `
  const resolveByEdit = failureDescription === 'message is too long'
  return (
    <Text type="BodySmall">
      <Text type="BodySmall" style={styles.failStyleFace}>
        {'┏(>_<)┓'}
      </Text>
      <Text type="BodySmall" style={styles.fail}>
        {' '}
        {error}
      </Text>
      {resolveByEdit && (
        <Text type="BodySmall" style={styles.failStyleUnderline} onClick={onEdit}>
          Edit
        </Text>
      )}
      {!resolveByEdit && (
        <Text type="BodySmall" style={styles.failStyleUnderline} onClick={onRetry}>
          Retry
        </Text>
      )}
    </Text>
  )
}

class MessageWrapper extends React.PureComponent<Props> {
  render() {
    const props = this.props
    return (
      <Box style={styles.container}>
        {props.orangeLineAbove && <Box style={styles.orangeLine} />}
        {props.hasOlderResetConversation && (
          <ProfileResetNotice conversationIDKey={props.message.conversationIDKey} />
        )}
        {props.loadMoreType && <LoadMore type={props.loadMoreType} />}
        {props.timestamp && <Timestamp timestamp={props.timestamp} />}
        <Box
          style={collapseStyles([
            styles.flexOneRow,
            props.isFirstNewMessage && styles.firstNewMessage,
            props.isSelected && styles.selected,
          ])}
        >
          <Box style={props.includeHeader ? styles.rightSideWithHeader : styles.rightSideNoHeader}>
            <UserAvatar
              author={props.author}
              showImage={props.includeHeader}
              onAuthorClick={props.onAuthorClick}
            />
            <Box style={styles.flexOneColumn} className="message-wrapper">
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
                <Box style={styles.flexOneColumn}>
                  <props.innerClass message={props.message} isEditing={props.isEditing} />
                  {props.isEdited && <EditedMark />}
                </Box>
                {!isMobile && <MenuButton onClick={props.onShowMenu} />}
                {props.isRevoked && <Icon type="iconfont-exclamation" style={styles.exclamation} />}
              </Box>
              {!!props.failureDescription && (
                <Failure
                  failureDescription={props.failureDescription}
                  onRetry={props.onRetry}
                  onEdit={props.onEdit}
                />
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    )
  }
}

const styles = styleSheetCreate({
  container: {...globalStyles.flexBoxColumn},
  edited: {backgroundColor: globalColors.white, color: globalColors.black_20_on_white},
  ellipsis: {fontSize: 16, marginLeft: globalMargins.tiny, marginRight: globalMargins.xtiny},
  exclamation: {
    color: globalColors.blue,
    fontSize: 11,
    paddingBottom: globalMargins.xtiny,
    paddingTop: globalMargins.xtiny,
  },
  fail: {color: globalColors.red},
  failStyleFace: {color: globalColors.red, fontSize: 9},
  failStyleUnderline: {color: globalColors.red, ...globalStyles.textDecoration('underline')},
  firstNewMessage: {
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderStyle: 'solid',
    borderTopColor: globalColors.orange,
    borderTopWidth: 1,
  },
  flexOneColumn: {...globalStyles.flexBoxColumn, flex: 1},
  flexOneRow: {...globalStyles.flexBoxRow, flex: 1},
  orangeLine: {backgroundColor: globalColors.orange, height: 1, width: '100%'},
  rightSideNoHeader: {
    ...globalStyles.flexBoxRow,
    flex: 1,
    marginLeft: globalMargins.tiny,
    paddingBottom: 2,
    paddingRight: globalMargins.tiny,
  },
  rightSideWithHeader: {
    ...globalStyles.flexBoxRow,
    flex: 1,
    marginLeft: globalMargins.tiny,
    paddingBottom: 2,
    paddingRight: globalMargins.tiny,
    paddingTop: 6,
  },
  selected: {backgroundColor: globalColors.black_05},
  textContainer: {
    ...globalStyles.flexBoxRow,
    borderRadius: 4,
    flex: 1,
    marginLeft: -globalMargins.xtiny,
    marginRight: globalMargins.xtiny,
    paddingLeft: globalMargins.xtiny,
    paddingRight: globalMargins.xtiny,
  },
  userAvatar: {width: 32},
  username: {
    alignSelf: 'flex-start',
    backgroundColor: globalColors.white,
    marginBottom: 2,
  },
  usernameYou: {
    ...globalStyles.italic,
  },
})

export default MessageWrapper
