// @flow
import * as React from 'react'
import * as Constants from '../../../constants/teams'
import {Avatar, Box, ProgressIndicator, Text, Button, Icon, Usernames} from '../../../common-adapters'
import {globalStyles, globalMargins} from '../../../styles'
import {isMobile} from '../../../constants/platform'

export type Props = {
  admin: boolean,
  follower: boolean,
  following: boolean,
  loading: boolean,
  user: Constants.MemberInfo,
  teamname: string,
  you: ?Constants.MemberInfo,
  onOpenProfile: () => void,
  onChat: () => void,
  onEditMembership: () => void,
  onBack: () => void,
}

const roleIconMap: any = {
  reader: 'iconfont-search',
  writer: 'iconfont-edit',
  admin: 'iconfont-crown',
  owner: 'iconfont-crown',
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
    you,
  } = props
  const buttonContainerStyle = isMobile ? {width: '90%', justifyContent: 'space-around'} : {}
  const buttonStyle = isMobile ? {width: '45%'} : {marginLeft: admin ? globalMargins.tiny : 0}
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
          ...globalStyles.flexBoxRow,
          marginTop: globalMargins.large,
          ...buttonContainerStyle,
        }}
      >
        {admin && <Button style={buttonStyle} type="Secondary" label="Edit" onClick={onEditMembership} />}
        <Button type="Primary" style={buttonStyle} label="Chat" onClick={onChat} />
      </Box>
    </Box>
  )
}
