// @flow
import React, {PureComponent} from 'react'
import {Text, MultiAvatar, Icon, Usernames, Markdown, Box, ClickableBox, NativeListView} from '../../common-adapters/index.native'
import {globalStyles, globalColors, globalMargins, statusBarHeight} from '../../styles'
import {RowConnector} from './row'

import type {Props, RowProps} from './'

const AddNewRow = ({onNewChat}: {onNewChat: () => void}) => (
  <Box
    style={{...globalStyles.flexBoxRow, alignItems: 'center', flexShrink: 0, justifyContent: 'center', minHeight: 48}}>
    <ClickableBox style={{...globalStyles.flexBoxColumn, padding: 8}} onClick={onNewChat}>
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', justifyContent: 'center'}}>
        <Icon type='iconfont-new' style={{color: globalColors.blue, marginRight: 9}} />
        <Text type='BodyBigLink'>New chat</Text>
      </Box>
    </ClickableBox>
  </Box>
)

// All this complexity isn't great but the current implementation of avatar forces us to juggle all these colors and
// forces us to explicitly choose undefined/the background/ etc. This can be cleaned up when avatar is simplified
function rowBorderColor (idx: number, isLastParticipant: boolean, backgroundColor: string) {
  // Only color the foreground items
  if (isLastParticipant) {
    return undefined
  }

  // We don't want a border if we're a single avatar
  return !idx && isLastParticipant ? undefined : backgroundColor
}

const Avatars = ({participants, youNeedToRekey, participantNeedToRekey, isMuted, hasUnread, isSelected, backgroundColor}) => {
  const avatarCount = Math.min(2, participants.count())

  let icon
  if (isMuted) {
    icon = <Icon type={isSelected ? 'icon-shh-active-16' : 'icon-shh-16'} style={avatarMutedIconStyle} />
  } else if (participantNeedToRekey || youNeedToRekey) {
    icon = <Icon type={isSelected ? 'icon-chat-addon-lock-active-8' : 'icon-chat-addon-lock-8'} style={avatarLockIconStyle} />
  }

  const avatarProps = participants.slice(0, 2).map((username, idx) => ({
    borderColor: rowBorderColor(idx, idx === (avatarCount - 1), backgroundColor),
    loadingColor: globalColors.blue3_40,
    size: 24,
    style: {
      opacity: youNeedToRekey || participantNeedToRekey ? 0.4 : 1,
    },
    username,
  })).toArray()

  return (
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1, justifyContent: 'flex-start', maxWidth: 48, paddingLeft: 4, backgroundColor}}>
      <MultiAvatar singleSize={32} multiSize={24} avatarProps={avatarProps} style={{backgroundColor}} />
      {icon}
    </Box>
  )
}

const TopLine = ({hasUnread, showBold, participants, subColor, timestamp, usernameColor}) => {
  const boldOverride = showBold ? globalStyles.fontBold : null
  return (
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', maxHeight: 17, minHeight: 17}}>
      <Box style={{...globalStyles.flexBoxRow, flex: 1, height: 17, position: 'relative'}}>
        <Box style={{...globalStyles.flexBoxColumn, bottom: 0, justifyContent: 'flex-start', left: 0, position: 'absolute', right: 0, top: 0}}>
          <Usernames
            inline={true}
            plainText={true}
            type='BodySemibold'
            style={{...boldOverride, color: usernameColor}}
            containerStyle={{color: usernameColor, paddingRight: 7}}
            users={participants.map(p => ({username: p})).toArray()}
            title={participants.join(', ')} />
        </Box>
      </Box>
      <Text type='BodySmall' style={{...boldOverride, color: subColor, lineHeight: 17}}>{timestamp}</Text>
      {hasUnread && <Box style={unreadDotStyle} />}
    </Box>
  )
}

const BottomLine = ({participantNeedToRekey, youNeedToRekey, isMuted, showBold, subColor, snippet, backgroundColor}) => {
  const boldOverride = showBold ? globalStyles.fontBold : null

  let content

  if (youNeedToRekey) {
    content = <Text type='BodySmallSemibold' backgroundMode='Terminal' style={{alignSelf: 'flex-start', backgroundColor: globalColors.red, borderRadius: 2, color: globalColors.white, fontSize: 10, paddingLeft: 2, paddingRight: 2}}>REKEY NEEDED</Text>
  } else if (participantNeedToRekey) {
    content = <Text type='BodySmall' backgroundMode='Terminal' style={{color: subColor}}>Waiting for participants to rekey</Text>
  } else if (snippet && !isMuted) {
    content = <Markdown preview={true} style={{...boldOverride, color: subColor, fontSize: 11, lineHeight: 20, minHeight: 20}}>{snippet}</Markdown>
  } else {
    return null
  }

  return (
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', maxHeight: 17, minHeight: 17, position: 'relative', backgroundColor}}>
      {content}
    </Box>
  )
}

const _Row = (props: RowProps) => {
  return (
    <ClickableBox onClick={() => props.onSelectConversation(props.conversationIDKey)} style={{backgroundColor: props.backgroundColor}}>
      <Box
        style={{...rowContainerStyle, backgroundColor: props.backgroundColor}}
        title={`${props.unreadCount} unread`}>
        <Avatars
          backgroundColor={props.backgroundColor}
          hasUnread={props.hasUnread}
          isMuted={props.isMuted}
          isSelected={props.isSelected}
          participantNeedToRekey={props.participantNeedToRekey}
          participants={props.participants}
          youNeedToRekey={props.youNeedToRekey}
        />
        <Box style={{
          ...globalStyles.flexBoxColumn,
          ...conversationRowStyle,
          backgroundColor: props.backgroundColor,
          borderBottomColor: (!props.isSelected && !props.hasUnread) ? globalColors.black_10 : props.backgroundColor,
          borderBottomWidth: 1,
        }}>
          <TopLine
            hasUnread={props.hasUnread}
            participants={props.participants}
            showBold={props.showBold}
            subColor={props.subColor}
            timestamp={props.timestamp}
            usernameColor={props.usernameColor}
          />
          <BottomLine
            backgroundColor={props.backgroundColor}
            isMuted={props.isMuted}
            participantNeedToRekey={props.participantNeedToRekey}
            showBold={props.showBold}
            snippet={props.snippet}
            subColor={props.subColor}
            youNeedToRekey={props.youNeedToRekey}
          />
        </Box>
      </Box>
    </ClickableBox>
  )
}

const Row = RowConnector(_Row)

type State = {
  dataSource: any,
}

class ConversationList extends PureComponent<void, Props, State> {
  state: State = {
    dataSource: null,
  }

  _itemRenderer = (conversationIDKey) => {
    return <Row conversationIDKey={conversationIDKey} key={conversationIDKey} />
  }

  _ds = new NativeListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2})

  _setupDataSource = (props: Props) => {
    this.setState({
      dataSource: this._ds.cloneWithRows(props.rows.toArray()),
    })
  }

  componentWillMount () {
    this.props.loadInbox()
    this._setupDataSource(this.props)
  }

  componentWillReceiveProps (nextProps: Props) {
    if (this.props.rows !== nextProps.rows) {
      this._setupDataSource(nextProps)
    }
  }

  render () {
    return (
      <Box style={boxStyle}>
        <AddNewRow onNewChat={this.props.onNewChat} />
        <NativeListView
          enableEmptySections={true}
          style={listStyle}
          dataSource={this.state.dataSource}
          renderRow={this._itemRenderer} />
      </Box>
    )
  }
}

const boxStyle = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.darkBlue4,
  flex: 1,
  paddingTop: statusBarHeight,
}

const listStyle = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
}

const unreadDotStyle = {
  backgroundColor: globalColors.orange,
  borderRadius: 3,
  height: 6,
  marginLeft: 4,
  width: 6,
}

const avatarMutedIconStyle = {
  marginLeft: -globalMargins.small,
  marginTop: 20,
  zIndex: 1,
}

const avatarLockIconStyle = {
  marginLeft: -10,
  marginTop: 20,
  zIndex: 1,
}

const conversationRowStyle = {
  flex: 1,
  justifyContent: 'center',
  paddingRight: 8,
}

const rowContainerStyle = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  flexShrink: 0,
  maxHeight: 48,
  minHeight: 48,
}

export default ConversationList
