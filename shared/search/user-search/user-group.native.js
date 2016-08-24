// @flow
import React from 'react'
import {Avatar, Box, Icon, Text, ClickableBox} from '../../common-adapters/index'
import {globalStyles, globalColors} from '../../styles/style-guide'

import type {IconType} from '../../common-adapters/icon'
import type {Props, UserFn} from './user-group'
import type {SearchResult, ExtraInfo} from '../../constants/search'

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

function User ({user, insertSpacing, onRemove, onClickUser}: {selected: boolean, user: SearchResult, insertSpacing: boolean, onRemove: UserFn, onClickUser: UserFn}) {
  let avatar: React$Element<any>

  if (user.service === 'keybase') {
    avatar = <Avatar style={avatarStyle} size={48} username={user.username} />
  } else if (user.extraInfo === 'external') {
    avatar = <Avatar style={avatarStyle} size={48} url={user.extraInfo.serviceAvatar} />
  } else {
    avatar = <Avatar style={avatarStyle} size={48} url={null} />
  }

  let name: React$Element<*>

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
    <ClickableBox onClick={() => onClickUser(user)}>
      <Box style={{...globalStyles.flexBoxColumn}}>
        <Box style={{...globalStyles.flexBoxRow, height: 64, alignItems: 'center', backgroundColor: globalColors.white}}>
          {avatar}
          {name}
          <Box style={{flex: 1, justifyContent: 'center', alignItems: 'flex-end', marginRight: 16}}>
            <Icon onClick={() => onRemove(user)} type={'iconfont-remove'} style={{fontSize: 24}} />
          </Box>
        </Box>
        {insertSpacing && <Box style={{height: 1}} />}
      </Box>
    </ClickableBox>
  )
}

function AddUser ({onClick}) {
  return (
    <ClickableBox onClick={onClick}>
      <Box style={{...globalStyles.flexBoxRow, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: globalColors.blue}}>
        <Icon type='icon-people-add-32' />
        <Text style={{marginLeft: 12, color: globalColors.white}} type='Body'>Add a user...</Text>
      </Box>
    </ClickableBox>
  )
}

function RowButton ({icon, text, onClick}: {icon: IconType, text: string, onClick: () => void}) {
  return (
    <ClickableBox onClick={onClick}>
      <Box style={rowButtonStyle}>
        <Icon type={icon} />
        <Text type='Body' style={{marginLeft: 8, color: globalColors.blue}}>{text}</Text>
      </Box>
    </ClickableBox>
  )
}

export default function UserGroup ({selectedUsers, onAddUser, onRemoveUserFromGroup, onClickUserInGroup, onOpenPublicGroupFolder, onOpenPrivateGroupFolder, chatEnabled, onGroupChat, userForInfoPane}: Props) {
  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1, backgroundColor: globalColors.lightGrey}}>
      <AddUser onClick={onAddUser} />
      {selectedUsers.map(u => <User key={u.service + u.username} selected={!!userForInfoPane && u.username === userForInfoPane.username} user={u} onRemove={onRemoveUserFromGroup} onClickUser={onClickUserInGroup} insertSpacing={true} />)}
      <RowButton icon='icon-folder-private-open-32' text='Open private folder' onClick={onOpenPrivateGroupFolder} />
      <RowButton icon='icon-folder-public-open-32' text='Open public folder' onClick={onOpenPublicGroupFolder} />
      {chatEnabled && <RowButton style={{color: globalColors.blue}} icon='iconfont-chat' text='Start a chat' onClick={onGroupChat} />}
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
