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
  const {user, you} = props
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
            onClick={props.onOpenProfile}
            style={{marginRight: globalMargins.tiny, alignSelf: 'center'}}
            username={user.username}
            showFollowingStatus={true}
            size={64}
          />
          {user.type && !!roleIconMap[user.type] && (
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
            teamname={props.teamname}
            size={64}
          />
        </Box>
        <Box
          style={{...globalStyles.flexBoxRow, alignItems: 'center', margin: globalMargins.small, height: 20}}
        >
          {props.loading && <ProgressIndicator style={{alignSelf: 'center', width: 20, height: 20}} />}
        </Box>
        <Usernames
          type="HeaderBig"
          colorFollowing={!(you && you.username === user.username)} // De-colorize if this is own member page
          users={[{username: user.username, following: props.following}]}
          onUsernameClicked={props.onOpenProfile}
        />
        <Text type="BodySmall">
          {user.type} in {props.teamname}
        </Text>
      </Box>
      <ButtonBar direction={isMobile ? 'column' : 'row'}>
        <Button label="Chat" type="Primary" onClick={props.onChat}>
          <Icon
            type="iconfont-chat"
            style={{
              marginRight: 8,
            }}
            color={globalColors.white}
          />
        </Button>
        {props.admin && <Button type="Secondary" label="Edit role" onClick={props.onEditMembership} />}
        {props.admin && (
          <Button
            type="Danger"
            label={you && you.username === user.username ? 'Leave team' : 'Remove'}
            onClick={props.onRemoveMember}
          />
        )}
      </ButtonBar>
    </Box>
  )
}
