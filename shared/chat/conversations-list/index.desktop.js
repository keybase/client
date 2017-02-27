// @flow
import React, {PureComponent} from 'react'
import ReactList from 'react-list'
import {Text, MultiAvatar, Icon, Usernames, Markdown} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
// import {shouldUpdate} from 'recompose'
import {getPath} from '../../route-tree'
import {connect} from 'react-redux'
import {isPendingConversationIDKey, newestConversationIDKey, participantFilter, nothingSelected} from '../../constants/chat'
import {formatTimeForConversationList} from '../../util/timestamp'
import {chatTab} from '../../constants/tabs'
import {selectConversation} from '../../actions/chat'

import type {TypedState} from '../../constants/reducer'
import type {Props, RowProps} from './'
import type {ConversationIDKey} from '../../constants/chat'

class AddNewRow extends PureComponent<void, {onNewChat: () => void}, void> {
  render () {
    return (
      <div
        style={{...globalStyles.flexBoxRow, alignItems: 'center', flexShrink: 0, justifyContent: 'center', minHeight: 48}}>
        <div style={{...globalStyles.flexBoxRow, ...globalStyles.clickable, alignItems: 'center', justifyContent: 'center'}} onClick={this.props.onNewChat}>
          <Icon type='iconfont-new' style={{color: globalColors.blue, marginRight: 9}} />
          <Text type='BodyBigLink'>New chat</Text>
        </div>
      </div>
    )
  }
}

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
    loadingColor: globalColors.blue3_40,
    borderColor: rowBorderColor(idx, idx === (avatarCount - 1), backgroundColor),
    size: 24,
    opacity: youNeedToRekey || participantNeedToRekey ? 0.4 : 1,
    username,
  })).toArray()

  return (
    <div style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1, justifyContent: 'flex-start', maxWidth: 48, paddingLeft: 4}}>
      <MultiAvatar singleSize={32} multiSize={24} avatarProps={avatarProps} />
      {icon}
    </div>
  )
}

const TopLine = ({hasUnread, showBold, participants, subColor, timestamp, usernameColor}) => {
  const boldOverride = showBold ? globalStyles.fontBold : null
  return (
    <div style={{...globalStyles.flexBoxRow, alignItems: 'center', maxHeight: 17, minHeight: 17}}>
      <div style={{...globalStyles.flexBoxRow, flex: 1, height: 17, position: 'relative'}}>
        <div style={{...globalStyles.flexBoxColumn, bottom: 0, justifyContent: 'flex-start', left: 0, position: 'absolute', right: 0, top: 0}}>
          <Usernames
            inline={true}
            type='BodySemibold'
            style={{...boldOverride, color: usernameColor}}
            plainText={true}
            containerStyle={{color: usernameColor, paddingRight: 7}}
            users={participants.map(p => ({username: p})).toArray()}
            title={participants.join(', ')} />
        </div>
      </div>
      <Text type='BodySmall' style={{...boldOverride, color: subColor, lineHeight: '17px'}}>{timestamp}</Text>
      {hasUnread && <div style={unreadDotStyle} />}
    </div>
  )
}

const BottomLine = ({participantNeedToRekey, youNeedToRekey, isMuted, showBold, subColor, snippet}) => {
  const boldOverride = showBold ? globalStyles.fontBold : null

  let content

  if (youNeedToRekey) {
    content = <Text type='BodySmallSemibold' backgroundMode='Terminal' style={{alignSelf: 'flex-start', backgroundColor: globalColors.red, borderRadius: 2, color: globalColors.white, fontSize: 10, paddingLeft: 2, paddingRight: 2}}>REKEY NEEDED</Text>
  } else if (participantNeedToRekey) {
    content = <Text type='BodySmall' backgroundMode='Terminal' style={{color: subColor}}>Waiting for participants to rekey</Text>
  } else if (snippet && !isMuted) {
    content = <Markdown preview={true} style={{...noWrapStyle, ...boldOverride, color: subColor, fontSize: 11, lineHeight: '15px', minHeight: 15}}>{snippet}</Markdown>
  } else {
    return null
  }

  return (
    <div style={{...globalStyles.flexBoxRow, alignItems: 'center', maxHeight: 17, minHeight: 17, position: 'relative'}}>
      <div style={{...globalStyles.flexBoxColumn, bottom: 0, justifyContent: 'flex-start', left: 0, position: 'absolute', right: 0, top: 0}}>
        {content}
      </div>
    </div>
  )
}

const _Row = (props: RowProps) => {
  return (
    <div
      onClick={() => props.onSelectConversation(props.conversationIDKey)}
      style={{...rowContainerStyle, backgroundColor: props.backgroundColor}}
      title={`${props.unreadCount} unread`}
    >
      <Avatars
        backgroundColor={props.backgroundColor}
        hasUnread={props.hasUnread}
        isMuted={props.isMuted}
        isSelected={props.isSelected}
        participantNeedToRekey={props.participantNeedToRekey}
        participants={props.participants}
        youNeedToRekey={props.youNeedToRekey}
      />
      <div style={{...globalStyles.flexBoxColumn, ...conversationRowStyle, borderBottom: (!props.isSelected && !props.hasUnread) ? `solid 1px ${globalColors.black_10}` : 'solid 1px transparent'}}>
        <TopLine
          hasUnread={props.hasUnread}
          participants={props.participants}
          showBold={props.showBold}
          subColor={props.subColor}
          timestamp={props.timestamp}
          usernameColor={props.usernameColor}
        />
        <BottomLine
          isMuted={props.isMuted}
          participantNeedToRekey={props.participantNeedToRekey}
          showBold={props.showBold}
          snippet={props.snippet}
          subColor={props.subColor}
          youNeedToRekey={props.youNeedToRekey}
        />
      </div>
    </div>
  )
}

const _selectedSelector = (state: TypedState) => {
  const chatPath = getPath(state.routeTree.routeState, [chatTab])
  if (chatPath.get(0) !== chatTab) {
    return null
  }
  const selected = chatPath.get(1)
  if (selected === nothingSelected) {
    return null
  }
  return selected
}

function _rowDerivedProps (rekeyInfo, unreadCount, isSelected) {
  // Derived props
  const youNeedToRekey = rekeyInfo && !rekeyInfo.get('rekeyParticipants').count() && rekeyInfo.get('youCanRekey')
  const participantNeedToRekey = rekeyInfo && !!rekeyInfo.get('rekeyParticipants').count()
  const hasUnread = !!unreadCount
  const subColor = isSelected ? globalColors.black_40 : hasUnread ? globalColors.white : globalColors.blue3_40
  const showBold = !isSelected && hasUnread
  const backgroundColor = isSelected ? globalColors.white : hasUnread ? globalColors.darkBlue : globalColors.darkBlue4
  const usernameColor = isSelected ? globalColors.black_75 : hasUnread ? globalColors.white : globalColors.blue3_60

  return {
    backgroundColor,
    hasUnread,
    participantNeedToRekey,
    showBold,
    subColor,
    usernameColor,
    youNeedToRekey,
  }
}

// $FlowIssue
const Row = connect(
  (state: TypedState, {conversationIDKey, nowOverride}) => {
    // returns a closure!
    const isPending = isPendingConversationIDKey(conversationIDKey)
    const users = state.chat.get('pendingConversations').findKey(v => v === conversationIDKey)
    return (state: TypedState) => {
      const you = state.config.username || ''
      const selectedConversation = newestConversationIDKey(_selectedSelector(state), state.chat)
      const isSelected = selectedConversation === conversationIDKey
      const rekeyInfos = state.chat.get('rekeyInfos')

      if (isPending) {
        const unreadCount = 0
        const participants = participantFilter(users, you)
        const isMuted = false
        const rekeyInfo = null
        const timestamp = formatTimeForConversationList(Date.now(), nowOverride)
        const snippet = ''

        return {
          conversationIDKey,
          isMuted,
          isSelected,
          participants,
          rekeyInfo,
          snippet,
          timestamp,
          unreadCount,
          ..._rowDerivedProps(rekeyInfo, unreadCount, isSelected),
        }
      } else {
        const conversation = state.chat.get('inbox').find(i => i.get('conversationIDKey') === conversationIDKey)
        const unreadCount = state.chat.get('conversationUnreadCounts').get(conversationIDKey)
        const participants = participantFilter(conversation.get('participants'), you)
        const isMuted = conversation.get('muted')
        const rekeyInfo = rekeyInfos.get(conversationIDKey)
        const timestamp = formatTimeForConversationList(conversation.get('time'), nowOverride)
        const snippet = conversation.get('snippet')

        return {
          conversationIDKey,
          isMuted,
          isSelected,
          participants,
          rekeyInfo,
          snippet,
          timestamp,
          unreadCount,
          ..._rowDerivedProps(rekeyInfo, unreadCount, isSelected),
        }
      }
    }
  },
  (dispatch) => ({
    onSelectConversation: (key: ConversationIDKey) => dispatch(selectConversation(key, true)),
  })
)(_Row)
// const Row = shouldUpdate((props: RowProps, nextProps: RowProps) => {
  // const different =
    // props.conversationIDKey !== nextProps.conversationIDKey ||
    // props.unreadCount !== nextProps.unreadCount ||
    // props.isSelected !== nextProps.isSelected ||
    // props.isMuted !== nextProps.isMuted ||
    // props.youNeedToRekey !== nextProps.youNeedToRekey ||
    // props.participantNeedToRekey !== nextProps.participantNeedToRekey ||
    // props.timestamp !== nextProps.timestamp ||
    // props.snippet !== nextProps.snippet ||
    // !props.participants.equals(nextProps.participants)
  // return different
// })(_Row)

let _loaded = false
class ConversationList extends PureComponent<void, Props, void> {
  componentWillMount () {
    if (!_loaded) {
      _loaded = true
      this.props.loadInbox()
    }
  }

  _itemRenderer = (index) => {
    const conversationIDKey = this.props.rows.get(index)
    return <Row conversationIDKey={conversationIDKey} key={conversationIDKey} />
  }

  render () {
    console.log('bbb inbox')
    return (
      <div style={containerStyle}>
        <AddNewRow onNewChat={this.props.onNewChat} />
        <div style={scrollableStyle}>
          <ReactList
            style={listStyle}
            useTranslate3d={true}
            useStaticSize={true}
            itemRenderer={this._itemRenderer}
            length={this.props.rows.count()}
            type='uniform' />
        </div>
      </div>
    )
  }
}

const listStyle = {
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

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.darkBlue4,
  flex: 1,
  maxWidth: 240,
}

const scrollableStyle = {
  overflowY: 'auto',
  willChange: 'transform',
}

const noWrapStyle = {
  display: 'block',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  width: '100%',
}

const rowContainerStyle = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  flexShrink: 0,
  maxHeight: 48,
  minHeight: 48,
}

export default ConversationList
