// @flow
import React from 'react'
import {Avatar, Box, ClickableBox, Icon, Text} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'
import {fullName, platformToLogo16} from '../../constants/search'

import type {IconType} from '../../common-adapters/icon'
import type {Props, UserFn} from './user-group'
import type {SearchResult} from '../../constants/search'

function User({
  selected,
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
  let avatarProps

  if (user.service === 'keybase') {
    avatarProps = {username: user.username}
  } else if (user.service === 'external') {
    avatarProps = {
      url: user.extraInfo.service === 'external'
        ? user.extraInfo.serviceAvatar
        : null,
    }
  }

  let name: React$Element<*>

  if (user.service === 'keybase') {
    name = (
      <Box style={{...globalStyles.flexBoxColumn}}>
        <Text
          type={'BodySemibold'}
          style={{
            color: user.isFollowing ? globalColors.green2 : globalColors.blue,
          }}
        >
          {user.username}
        </Text>
        <Text type={'BodySmall'}>{fullName(user.extraInfo)}</Text>
      </Box>
    )
  } else if (user.service === 'external') {
    name = (
      <Box style={{...globalStyles.flexBoxColumn}}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
          <Icon
            style={{marginRight: 5}}
            type={platformToLogo16(user.serviceName)}
          />
          <Text type={'Body'}>{user.username}</Text>
        </Box>
        <Text type={'BodySmall'}>{fullName(user.extraInfo)}</Text>
      </Box>
    )
  }

  return (
    <Box style={{...globalStyles.flexBoxColumn}}>
      <ClickableBox
        hoverColor={globalColors.blue4}
        backgroundColor={selected ? globalColors.blue4 : null}
        onClick={() => onClickUser(user)}
        style={userRowStyle}
      >
        <Avatar style={avatarStyle} size={32} {...avatarProps} />
        {name}
        <Box
          style={{
            ...globalStyles.flexBoxColumn,
            flex: 1,
            justifyContent: 'center',
            alignItems: 'flex-end',
            marginRight: 16,
          }}
        >
          <Icon
            onClick={e => {
              e && e.stopPropagation()
              onRemove(user)
            }}
            type={'iconfont-remove'}
            style={{
              color: globalColors.black_20,
              hoverColor: globalColors.black_60,
            }}
          />
        </Box>
      </ClickableBox>
      {insertSpacing && <Box style={{height: 1}} />}
    </Box>
  )
}

const GroupAction = ({
  onClick,
  icon,
  label,
  style,
}: {
  onClick: () => void,
  icon: IconType,
  label: string,
  style?: ?Object,
}) => (
  <Box style={groupActionStyle} onClick={onClick}>
    <Icon style={{marginRight: 9, ...style}} type={icon} />
    <Text type="BodyPrimaryLink">{label}</Text>
  </Box>
)

export default function UserGroup({
  selectedUsers,
  onClickUserInGroup,
  onRemoveUserFromGroup,
  onOpenPublicGroupFolder,
  onOpenPrivateGroupFolder,
  onGroupChat,
  userForInfoPane,
}: Props) {
  const privateFolderText = selectedUsers.length > 1
    ? 'Open private group folder'
    : 'Open private folder'

  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
      {selectedUsers.map(u => (
        <User
          key={u.service + u.username}
          selected={
            !!userForInfoPane && u.username === userForInfoPane.username
          }
          user={u}
          onRemove={onRemoveUserFromGroup}
          onClickUser={onClickUserInGroup}
          insertSpacing={true}
        />
      ))}
      <GroupAction
        onClick={onOpenPrivateGroupFolder}
        icon="icon-folder-private-open-24"
        label={privateFolderText}
      />
      {selectedUsers.length === 1 &&
        <GroupAction
          onClick={onOpenPublicGroupFolder}
          icon="icon-folder-public-open-24"
          label="Open public folder"
        />}
      <GroupAction
        onClick={onGroupChat}
        icon="iconfont-chat"
        label="Start a chat"
        style={{color: globalColors.blue}}
      />
    </Box>
  )
}

const avatarStyle = {
  marginLeft: 8,
  marginRight: 16,
}

const userRowStyle = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  height: 48,
  alignItems: 'center',
}

const groupActionStyle = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  height: 36,
  alignItems: 'center',
  justifyContent: 'center',
}
