// @flow
import React, {PureComponent} from 'react'
import ReactList from 'react-list'
import {Text, MultiAvatar, Icon, Usernames, Markdown} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {RowConnector} from './row'
import {debounce} from 'lodash'
import KeyHandler from '../../util/key-handler.desktop'

import type {Props, RowProps} from './'

class _AddNewRow extends PureComponent<void, {onNewChat: () => void}, void> {
  render() {
    return (
      <div
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          flexShrink: 0,
          justifyContent: 'center',
          minHeight: 48,
        }}
      >
        <div
          style={{
            ...globalStyles.flexBoxRow,
            ...globalStyles.clickable,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={this.props.onNewChat}
        >
          <Icon type="iconfont-new" style={{color: globalColors.blue, marginRight: 9}} />
          <Text type="BodyBigLink">New chat</Text>
        </div>
      </div>
    )
  }
}
const AddNewRow = KeyHandler(_AddNewRow)

class NewConversation extends PureComponent<void, {}, void> {
  render() {
    return (
      <div
        style={{
          ...globalStyles.flexBoxRow,
          backgroundColor: globalColors.blue,
          alignItems: 'center',
          flexShrink: 0,
          minHeight: 48,
        }}
      >
        <div
          style={{
            ...globalStyles.flexBoxRow,
            ...globalStyles.clickable,
            alignItems: 'center',
          }}
        >
          <div
            style={{
              borderRadius: globalMargins.large,
              padding: globalMargins.tiny,
              width: globalMargins.large,
              height: globalMargins.large,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              marginLeft: globalMargins.tiny,
              marginRight: globalMargins.tiny,
            }}
          >
            <Icon
              type="iconfont-people"
              style={{
                color: globalColors.blue,
                fontSize: 24,
                marginLeft: 1,
                marginTop: 1,
              }}
            />
          </div>
          <Text style={{color: globalColors.white}} type="BodySemibold">New conversation</Text>
        </div>
      </div>
    )
  }
}

// All this complexity isn't great but the current implementation of avatar forces us to juggle all these colors and
// forces us to explicitly choose undefined/the background/ etc. This can be cleaned up when avatar is simplified
function rowBorderColor(idx: number, isLastParticipant: boolean, backgroundColor: string) {
  // Only color the foreground items
  if (isLastParticipant) {
    return undefined
  }

  // We don't want a border if we're a single avatar
  return !idx && isLastParticipant ? undefined : backgroundColor
}

const Avatars = ({
  participants,
  youNeedToRekey,
  participantNeedToRekey,
  isMuted,
  hasUnread,
  isSelected,
  backgroundColor,
}) => {
  const avatarCount = Math.min(2, participants.count())

  let icon
  if (isMuted) {
    icon = <Icon type={isSelected ? 'icon-shh-active-16' : 'icon-shh-16'} style={avatarMutedIconStyle} />
  } else if (participantNeedToRekey || youNeedToRekey) {
    icon = (
      <Icon
        type={isSelected ? 'icon-addon-lock-active-8' : 'icon-addon-lock-8'}
        style={avatarLockIconStyle}
      />
    )
  }

  const avatarProps = participants
    .slice(0, 2)
    .map((username, idx) => ({
      loadingColor: globalColors.lightGrey,
      borderColor: rowBorderColor(idx, idx === avatarCount - 1, backgroundColor),
      size: 24,
      opacity: youNeedToRekey || participantNeedToRekey ? 0.4 : 1,
      username,
    }))
    .toArray()

  return (
    <div
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        flex: 1,
        justifyContent: 'flex-start',
        maxWidth: 48,
        paddingLeft: globalMargins.tiny,
      }}
    >
      <MultiAvatar singleSize={40} multiSize={32} avatarProps={avatarProps} />
      {icon}
    </div>
  )
}

const TopLine = ({hasUnread, showBold, participants, subColor, timestamp, usernameColor}) => {
  const boldOverride = showBold ? globalStyles.fontBold : null
  return (
    <div style={{...globalStyles.flexBoxRow, alignItems: 'center', maxHeight: 17, minHeight: 17}}>
      <div style={{...globalStyles.flexBoxRow, flex: 1, height: 17, position: 'relative'}}>
        <div
          style={{
            ...globalStyles.flexBoxColumn,
            bottom: 0,
            justifyContent: 'flex-start',
            left: 0,
            position: 'absolute',
            right: 0,
            top: 0,
          }}
        >
          <Usernames
            inline={true}
            type="BodySemibold"
            plainText={true}
            plainDivider={',\u200a'}
            containerStyle={{...boldOverride, color: usernameColor, paddingRight: 6}}
            users={participants.map(p => ({username: p})).toArray()}
            title={participants.join(', ')}
          />
        </div>
      </div>
      <Text type="BodySmall" style={{...boldOverride, color: subColor, lineHeight: '17px'}}>{timestamp}</Text>
      {hasUnread && <div style={unreadDotStyle} />}
    </div>
  )
}

const BottomLine = ({participantNeedToRekey, youNeedToRekey, showBold, subColor, snippet}) => {
  const boldOverride = showBold ? globalStyles.fontBold : null

  let content

  if (youNeedToRekey) {
    content = (
      <Text
        type="BodySmallSemibold"
        backgroundMode="Terminal"
        style={{
          alignSelf: 'flex-start',
          backgroundColor: globalColors.red,
          borderRadius: 2,
          color: globalColors.white,
          fontSize: 10,
          paddingLeft: 2,
          paddingRight: 2,
        }}
      >
        REKEY NEEDED
      </Text>
    )
  } else if (participantNeedToRekey) {
    content = (
      <Text type="BodySmall" backgroundMode="Terminal" style={{color: subColor}}>
        Waiting for participants to rekey
      </Text>
    )
  } else if (snippet) {
    content = (
      <Markdown
        preview={true}
        style={{
          ...noWrapStyle,
          ...boldOverride,
          color: subColor,
          fontSize: 11,
          lineHeight: '15px',
          minHeight: 15,
        }}
      >
        {snippet}
      </Markdown>
    )
  } else {
    return null
  }

  return (
    <div
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        maxHeight: 17,
        minHeight: 17,
        position: 'relative',
      }}
    >
      <div
        style={{
          ...globalStyles.flexBoxColumn,
          bottom: 0,
          justifyContent: 'flex-start',
          left: 0,
          position: 'absolute',
          right: 0,
          top: 0,
        }}
      >
        {content}
      </div>
    </div>
  )
}

const _Row = (props: RowProps) => {
  return (
    <div
      onClick={() => props.onSelectConversation(props.conversationIDKey)}
      style={{...rowContainerStyle, backgroundColor: props.backgroundColor, marginRight: props.marginRight}}
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
      <div
        style={{
          ...globalStyles.flexBoxColumn,
          ...conversationRowStyle,
        }}
      >
        <TopLine
          hasUnread={props.hasUnread}
          participants={props.participants}
          showBold={props.showBold}
          subColor={props.subColor}
          timestamp={props.timestamp}
          usernameColor={props.usernameColor}
        />
        <BottomLine
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

const Row = RowConnector(_Row)

class Inbox extends PureComponent<void, Props, void> {
  _list: any

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.rows !== nextProps.rows && nextProps.rows.count()) {
      this._onScroll()
    }
  }

  _itemRenderer = index => {
    const conversationIDKey = this.props.rows.get(index)
    return <Row conversationIDKey={conversationIDKey} key={conversationIDKey} />
  }

  _onScroll = debounce(() => {
    if (!this._list) {
      return
    }

    const [first, end] = this._list.getVisibleRange()
    const conversationIDKey = this.props.rows.get(first)
    this.props.onUntrustedInboxVisible(conversationIDKey, end - first)
  }, 200)

  _setRef = list => {
    this._list = list
  }

  render() {
    return (
      <div style={containerStyle}>
        <AddNewRow
          onNewChat={this.props.onNewChat}
          hotkeys={['ctrl+n', 'command+n']}
          onHotkey={this.props.onNewChat}
        />
        {this.props.showNewConversation && <NewConversation />}
        <div style={scrollableStyle} onScroll={this._onScroll}>
          <ReactList
            ref={this._setRef}
            style={listStyle}
            useTranslate3d={true}
            useStaticSize={true}
            itemRenderer={this._itemRenderer}
            length={this.props.rows.count()}
            type="uniform"
          />
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
  marginTop: 32,
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
  paddingLeft: 8,
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.white,
  boxShadow: `inset -1px 0 0 ${globalColors.black_05}`,
  flex: 1,
  maxWidth: 241,
  minWidth: 241,
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
  maxHeight: 56,
  minHeight: 56,
}

export default Inbox
