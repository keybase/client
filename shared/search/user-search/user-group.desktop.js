// @flow
import React from 'react'
import {Avatar, Box, ClickableBox, Icon, Text} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles/style-guide'
import {fullName, platformToLogo16} from '../../constants/search'

import type {IconType} from '../../common-adapters/icon'
import type {Props, UserFn} from './user-group'
import type {SearchResult} from '../../constants/search'

function User ({user, insertSpacing, onRemove, onClickUser}: {user: SearchResult, insertSpacing: boolean, onRemove: UserFn, onClickUser: UserFn}) {
  let avatar: React$Element

  if (user.service === 'keybase') {
    avatar = <Avatar style={avatarStyle} size={32} username={user.username} />
  } else if (user.extraInfo === 'external') {
    avatar = <Avatar style={avatarStyle} size={32} url={user.extraInfo.serviceAvatar} />
  } else {
    avatar = <Avatar style={avatarStyle} size={32} url={null} />
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
          <Icon style={{marginRight: 5}} type={platformToLogo16(user.serviceName)} />
          <Text type={'Body'}>{user.username}</Text>
        </Box>
        <Text type={'BodySmall'}>{fullName(user.extraInfo)}</Text>
      </Box>
    )
  }

  return (
    <Box style={{...globalStyles.flexBoxColumn}}>
      <ClickableBox hoverColor={globalColors.blue4} backgroundColor={globalColors.white} onClick={() => onClickUser(user)} style={userRowStyle}>
        {avatar}
        {name}
        <Box style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'center', alignItems: 'flex-end', marginRight: 16}}>
          <Icon onClick={e => { e && e.stopPropagation(); onRemove(user) }} type={'fa-kb-iconfont-remove'} style={{color: globalColors.black_20}} />
        </Box>
      </ClickableBox>
      {insertSpacing && <Box style={{height: 1}} />}
    </Box>
  )
}

function RowButton ({icon, text, onClick, iconStyle, rowStyle}:
    {icon: IconType, text: string, onClick: () => void, iconStyle?: Object, rowStyle?: Object}) {
  return (
    <ClickableBox hoverColor={globalColors.blue4} backgroundColor={globalColors.white} onClick={onClick} style={rowButtonStyle}>
      <Icon style={iconStyle} type={icon} />
      <Text type='Body' style={{marginLeft: 4, color: globalColors.blue}}>{text}</Text>
    </ClickableBox>
  )
}

export default function UserGroup ({users, onClickUser, onRemoveUser, onOpenPublicGroupFolder, onOpenPrivateGroupFolder, chatEnabled, onGroupChat}: Props) {
  const privateFolderText = users.length > 1 ? 'Open private group folder' : 'Open shared private folder'

  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1, backgroundColor: globalColors.lightGrey}}>
      {users.map(u => <User key={u.service + u.username} user={u} onRemove={onRemoveUser} onClickUser={onClickUser} insertSpacing />)}
      <RowButton rowStyle={{height: 32}} iconStyle={{marginRight: 4}} icon='icon-folder-private-open-24' text={privateFolderText} onClick={onOpenPrivateGroupFolder} />
      {users.length === 1 && <RowButton rowStyle={{height: 32}} iconStyle={{marginRight: 4}} icon='icon-folder-public-open-24' text='Open public folder' onClick={onOpenPublicGroupFolder} />}
      {chatEnabled && <RowButton rowStyle={{height: 32}} iconStyle={{color: globalColors.blue}} icon='fa-kb-iconfont-chat' text='Start group chat' onClick={onGroupChat} />}
    </Box>
  )
}

const avatarStyle = {
  marginLeft: 8,
  marginRight: 16,
}

const rowButtonStyle = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  height: 48,
  alignItems: 'center',
  justifyContent: 'center',
}

const userRowStyle = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  height: 48,
  alignItems: 'center',
}
