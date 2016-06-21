// @flow
import React from 'react'
import {TouchableHighlight} from 'react-native'
import {Avatar, Box, Icon, Text} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles/style-guide'

import type {IconType} from '../../common-adapters/icon'
import type {Props, UserFn} from './user-group'
import type {SearchResult, ExtraInfo} from './render'

function fullName (extraInfo: ExtraInfo): string {
  switch (extraInfo.service) {
    case 'keybase':
    case 'none':
      return extraInfo.fullName
    case 'external':
      return extraInfo.fullNameOnService || ''
  }
  return ''
}

function User ({user, insertSpacing, onRemove, onClickUser}: {user: SearchResult, insertSpacing: boolean, onRemove: UserFn, onClickUser: UserFn}) {
  let avatar: React$Element

  if (user.service === 'keybase') {
    avatar = <Avatar style={avatarStyle} size={48} username={user.username} />
  } else if (user.extraInfo === 'external') {
    avatar = <Avatar style={avatarStyle} size={48} url={user.extraInfo.serviceAvatar} />
  } else {
    avatar = <Avatar style={avatarStyle} size={48} url={null} />
  }

  let name: React$Element

  if (user.service === 'keybase') {
    name = (
      <Box style={{...globalStyles.flexBoxColumn}}>
        <Text type={'Body'} style={{color: user.isFollowing ? globalColors.green2 : globalColors.orange}}>{user.username}</Text>
        <Text type={'BodySmall'}>{fullName(user.extraInfo)}</Text>
      </Box>
    )
  } else if (user.service === 'external') {
    name = (
      <Box style={{...globalStyles.flexBoxColumn}}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
          <Icon style={{marginRight: 5}} type={user.icon} />
          <Text type={'Body'}>{user.username}</Text>
        </Box>
        <Text type={'BodySmall'}>{fullName(user.extraInfo)}</Text>
      </Box>
    )
  }

  return (
    <TouchableHighlight
      onPress={() => onClickUser(user)}
      activeOpacity={0.8}>
      <Box style={{...globalStyles.flexBoxColumn}}>
        <Box style={{...globalStyles.flexBoxRow, height: 64, alignItems: 'center', backgroundColor: globalColors.white}}>
          {avatar}
          {name}
          <Box style={{flex: 1, justifyContent: 'center', alignItems: 'flex-end', marginRight: 16}}>
            <Icon onClick={() => onRemove(user)} type={'fa-times-circle'} style={{fontSize: 24}} />
          </Box>
        </Box>
        {insertSpacing && <Box style={{height: 1}} />}
      </Box>
    </TouchableHighlight>
  )
}

function AddUser ({onClick}) {
  return (
    <TouchableHighlight
      onPress={onClick}
      activeOpacity={0.8}>
      <Box style={{...globalStyles.flexBoxRow, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: globalColors.blue}}>
        <Icon type='icon-people-add-32' />
        <Text style={{marginLeft: 12, color: globalColors.white}} type='Body'>Add a user...</Text>
      </Box>
    </TouchableHighlight>
  )
}

function RowButton ({icon, text, onClick}: {icon: IconType, text: string, onClick: () => void}) {
  return (
    <TouchableHighlight
      onPress={onClick}
      activeOpacity={0.8}>
      <Box style={rowButtonStyle}>
        <Icon type={icon} />
        <Text type='Body' style={{marginLeft: 8, color: globalColors.blue}}>{text}</Text>
      </Box>
    </TouchableHighlight>
  )
}

export default function UserGroup ({users, onAddUser, onRemoveUser, onClickUser, onOpenPublicGroupFolder, onOpenPrivateGroupFolder, chatEnabled, onGroupChat}: Props) {
  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1, backgroundColor: globalColors.lightGrey}}>
      <AddUser onClick={onAddUser} />
      {users.map(u => <User key={u.service + u.username} user={u} onRemove={onRemoveUser} onClickUser={onClickUser} insertSpacing />)}
      <RowButton icon='icon-folder-private-open-32' text='Open private folder' onClick={onOpenPrivateGroupFolder} />
      <RowButton icon='icon-folder-public-open-32' text='Open public folder' onClick={onOpenPublicGroupFolder} />
      {chatEnabled && <RowButton icon='icon-chat-32' text='Start a chat' onClick={onGroupChat} />}
    </Box>
  )
}

const avatarStyle = {
  marginLeft: 8,
  marginRight: 16,
}

const rowButtonStyle = {
  ...globalStyles.flexBoxRow,
  backgroundColor: globalColors.white,
  height: 48,
  alignItems: 'center',
  justifyContent: 'center',
}
