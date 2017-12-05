// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import {Avatar, Box, ProgressIndicator, Text, Button, Icon, Usernames} from '../../../common-adapters'
import {globalStyles, globalMargins} from '../../../styles'
import {isMobile} from '../../../constants/platform'
import {roleIconMap} from '../../role-picker/index.meta'

export type Props = {
  admin: boolean,
  follower: boolean,
  following: boolean,
  loading: boolean,
  user: Types.MemberInfo,
  teamname: string,
  you: ?Types.MemberInfo,
  onOpenProfile: () => void,
  onChat: () => void,
  onEditMembership: () => void,
  onRemoveMember: () => void,
  onBack: () => void,
}

export const TeamMember = (props: Props) => {
  const {
    admin,
    follower,
    following,
    loading,
    user,
    teamname,
    onOpenProfile,
    onChat,
    onEditMembership,
    onRemoveMember,
    you,
  } = props
  const buttonContainerStyle = isMobile ? {width: '90%', justifyContent: 'space-around'} : {}
  const buttonStyle = isMobile ? {marginTop: globalMargins.tiny} : {marginLeft: globalMargins.tiny}
  return (
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1}}>
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          alignItems: 'center',
          marginBottom: globalMargins.large,
          marginTop: globalMargins.large,
        }}
      >
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
            following={following}
            followsYou={follower}
            size={64}
          />
          {user.type &&
            !!roleIconMap[user.type] &&
            <Icon
              type={roleIconMap[user.type]}
              style={{
                fontSize: isMobile ? 28 : 28,
                margin: globalMargins.tiny,
                alignSelf: 'center',
              }}
            />}
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
        <Usernames
          type="HeaderBig"
          colorFollowing={!(you && you.username === user.username)} // De-colorize if this is own member page
          users={[{username: user.username, following}]}
          onUsernameClicked={() => onOpenProfile()}
        />
        <Text type="BodySmall">{user.type} in {teamname}</Text>
      </Box>
      <Box
        style={{
          ...(isMobile ? globalStyles.flexBoxColumn : globalStyles.flexBoxRow),
          marginTop: globalMargins.large,
          ...buttonContainerStyle,
        }}
      >
        <Button type="Primary" label="Chat" onClick={onChat} />
        {admin &&
          <Button style={buttonStyle} type="Secondary" label="Edit role" onClick={onEditMembership} />}
        {admin &&
          <Button
            style={buttonStyle}
            type="Danger"
            label={you && you.username === user.username ? 'Leave team' : 'Remove'}
            onClick={onRemoveMember}
          />}
      </Box>
    </Box>
  )
}
