// @flow
import React from 'react'
import {Avatar, Box, Icon, Text, ClickableBox, NativeScrollView} from '../../common-adapters/index.native'
import {globalStyles, globalColors} from '../../styles'

import type {IconType} from '../../common-adapters/icon'
import type {Props, UserFn} from './user-group'
import type {SearchResult, ExtraInfo} from '../../constants/search'

function fullName(extraInfo: ExtraInfo): string {
  switch (extraInfo.service) {
    case 'keybase':
    case 'none':
      return extraInfo.fullName
    case 'external':
      return extraInfo.fullNameOnService || ''
  }
  return ''
}

function User({
  user,
  insertSpacing,
  onRemove,
  onClickUser,
}: {
  selected: boolean,
  user: SearchResult,
  insertSpacing: boolean,
  onRemove: UserFn,
  onClickUser: UserFn,
}) {
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
      <Box style={globalStyles.flexBoxColumn}>
        <Text
          type={'BodySemibold'}
          style={{color: user.isFollowing ? globalColors.green2 : globalColors.blue}}
        >
          {user.username}
        </Text>
        <Text type={'BodySmall'}>
          {fullName(user.extraInfo)}
        </Text>
      </Box>
    )
  } else if (user.service === 'external') {
    name = (
      <Box style={globalStyles.flexBoxColumn}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
          <Icon style={{marginRight: 5}} type={user.icon} />
          <Text type={'BodySemibold'}>
            {user.username}
          </Text>
        </Box>
        <Text type={'BodySmall'}>
          {fullName(user.extraInfo)}
        </Text>
      </Box>
    )
  }

  return (
    <ClickableBox onClick={() => onClickUser(user)}>
      <Box style={globalStyles.flexBoxColumn}>
        <Box
          style={{
            ...globalStyles.flexBoxRow,
            height: 64,
            alignItems: 'center',
            backgroundColor: globalColors.white,
          }}
        >
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

const GroupAction = ({
  icon,
  label,
  onClick,
  style,
}: {
  icon: IconType,
  label: string,
  onClick: () => void,
  style?: ?Object,
}) =>
  <ClickableBox onClick={onClick}>
    <Box style={rowButtonStyle}>
      <Icon type={icon} style={style} />
      <Text type="Body" style={{color: globalColors.blue, marginLeft: 8}}>
        {label}
      </Text>
    </Box>
  </ClickableBox>

export default function UserGroup({
  selectedUsers,
  onRemoveUserFromGroup,
  onClickUserInGroup,
  onOpenPublicGroupFolder,
  onOpenPrivateGroupFolder,
  onGroupChat,
  userForInfoPane,
}: Props) {
  return (
    <NativeScrollView
      style={{...globalStyles.flexBoxColumn, backgroundColor: globalColors.lightGrey, flex: 1}}
    >
      {selectedUsers.map(u =>
        <User
          key={u.service + u.username}
          selected={!!userForInfoPane && u.username === userForInfoPane.username}
          user={u}
          onRemove={onRemoveUserFromGroup}
          onClickUser={onClickUserInGroup}
          insertSpacing={true}
        />
      )}
      <GroupAction
        icon="icon-folder-private-open-32"
        label="Open private folder"
        onClick={onOpenPrivateGroupFolder}
      />
      {selectedUsers.length === 1 &&
        <GroupAction
          onClick={onOpenPublicGroupFolder}
          icon="icon-folder-public-open-24"
          label="Open public folder"
        />}
      <GroupAction
        style={{color: globalColors.blue}}
        icon="iconfont-chat"
        label="Start a chat"
        onClick={onGroupChat}
      />
    </NativeScrollView>
  )
}

const avatarStyle = {
  marginLeft: 8,
  marginRight: 16,
}

const rowButtonStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  backgroundColor: globalColors.white,
  height: 48,
  justifyContent: 'center',
}
