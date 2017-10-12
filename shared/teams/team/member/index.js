// @flow
import * as React from 'react'
import * as Constants from '../../../constants/teams'
import {Avatar, Box, ProgressIndicator, Text, Button, Icon} from '../../../common-adapters'
import {globalStyles, globalMargins} from '../../../styles'
import {isMobile} from '../../../constants/platform'

export type Props = {
  admin: boolean,
  loading: boolean,
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
  const {admin, loading, user, teamname, onOpenProfile, onChat, onEditMembership} = props
  return (
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1}}>
      <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', marginBottom: globalMargins.large}}>
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
            size={64}
          />
          <Icon
            type={roleIconMap[user.type] || 'iconfont-close'}
            style={{
              fontSize: isMobile ? 28 : 28,
              margin: globalMargins.tiny,
              alignSelf: 'center',
            }}
          />
          <Avatar
            style={{marginLeft: globalMargins.tiny, alignSelf: 'center'}}
            isTeam={true}
            teamname={teamname}
            size={64}
          />
        </Box>
        <Box
          style={{...globalStyles.flexBoxRow, alignItems: 'center', margin: globalMargins.small, height: 20}}
        >
          {loading && <ProgressIndicator style={{alignSelf: 'center', width: 20, height: 20}} />}
        </Box>
        <Text type="Header">{user.username}</Text>
        <Text type="BodySmall">{user.type} in {teamname}</Text>
      </Box>
      <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.large}}>
        {admin && <Button type="Secondary" label="Edit" onClick={onEditMembership} />}
        <Button type="Primary" style={{marginLeft: globalMargins.tiny}} label="Chat" onClick={onChat} />
        <Button
          type="Secondary"
          style={{marginLeft: globalMargins.tiny}}
          label="View"
          onClick={onOpenProfile}
        />
      </Box>
    </Box>
  )
}
