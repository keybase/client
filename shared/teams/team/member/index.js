// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import {
  Avatar,
  Box,
  ProgressIndicator,
  Text,
  Button,
  Icon,
  Usernames,
  ButtonBar,
} from '../../../common-adapters'
import {globalColors, globalStyles, globalMargins, isMobile} from '../../../styles'
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
            onClick={onOpenProfile}
            style={{marginRight: globalMargins.tiny, alignSelf: 'center'}}
            username={user.username}
            following={following}
            followsYou={follower}
            size={64}
          />
          {user.type &&
            !!roleIconMap[user.type] && (
              <Icon
                type={roleIconMap[user.type]}
                style={{
                  margin: globalMargins.tiny,
                  alignSelf: 'center',
                }}
                fontSize={28}
              />
            )}
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
          onUsernameClicked={onOpenProfile}
        />
        <Text type="BodySmall">
          {user.type} in {teamname}
        </Text>
      </Box>
      <ButtonBar direction={isMobile ? 'column' : 'row'}>
        <Button label="Chat" type="Primary" onClick={onChat}>
          <Icon
            type="iconfont-chat"
            style={{
              marginRight: 8,
            }}
            color={globalColors.white}
          />
        </Button>
        {admin && <Button type="Secondary" label="Edit role" onClick={onEditMembership} />}
        {admin && (
          <Button
            type="Danger"
            label={you && you.username === user.username ? 'Leave team' : 'Remove'}
            onClick={onRemoveMember}
          />
        )}
      </ButtonBar>
    </Box>
  )
}
