// @flow
import * as React from 'react'
import * as Constants from '../../../constants/teams'
import {Avatar, Box, Text, Button, Icon} from '../../../common-adapters'
import {globalStyles, globalMargins} from '../../../styles'
import {isMobile} from '../../../constants/platform'

export type Props = {
  user: Constants.MemberInfo,
  teamname: string,
  you: ?Constants.MemberInfo,
  onOpenProfile: () => void,
  onChat: () => void,
  onEditMembership: () => void,
  onBack: () => void,
}

const roleIconMap = {
  reader: 'iconfont-search',
  writer: 'iconfont-edit',
  admin: 'iconfont-crown',
  owner: 'iconfont-crown',
}

export const TeamMember = (props: Props) => {
  const {user, teamname, you, onOpenProfile, onChat, onEditMembership} = props
  return (
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          margin: globalMargins.small,
        }}
      >
        <Avatar
          style={{marginRight: globalMargins.tiny, alignSelf: 'center'}}
          username={user.username}
          size={isMobile ? 64 : 48}
        />
        <Icon
          type={roleIconMap[user.type] || 'iconfont-close'}
          style={{
            fontSize: isMobile ? 28 : 20,
            margin: globalMargins.tiny,
            alignSelf: 'center',
          }}
        />
        <Avatar
          style={{marginLeft: globalMargins.tiny, alignSelf: 'center'}}
          isTeam={true}
          teamname={teamname}
          size={isMobile ? 64 : 48}
        />
      </Box>
      <Text type="Header">{user.username}</Text>
      <Text type="BodySmall">{user.type} in {teamname}</Text>
      <Text type="Header">you: {you && you.username}</Text>
      <Button type="Primary" label="Edit" onClick={onEditMembership} />
      <Button type="Primary" label="Chat" onClick={onChat} />
      <Button type="Primary" label="Open" onClick={onOpenProfile} />
    </Box>
  )
}
