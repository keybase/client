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
            style={{alignSelf: 'center', marginRight: globalMargins.tiny}}
            username={user.username}
            showFollowingStatus={true}
            size={64}
          />
          {user.type && !!roleIconMap[user.type] && (
            <Icon
              type={roleIconMap[user.type]}
              style={{
                alignSelf: 'center',
                margin: globalMargins.tiny,
              }}
              fontSize={28}
            />
          )}
          <Avatar
            style={{alignSelf: 'center', marginLeft: globalMargins.tiny}}
            isTeam={true}
            teamname={props.teamname}
            size={64}
          />
        </Box>
        <Box
          style={{...globalStyles.flexBoxRow, alignItems: 'center', height: 20, margin: globalMargins.small}}
        >
          {props.loading && <ProgressIndicator style={{alignSelf: 'center', height: 20, width: 20}} />}
        </Box>
        <Usernames
          type="HeaderBig"
          colorFollowing={!(you && you.username === user.username)} // De-colorize if this is own member page
          users={[{following: props.following, username: user.username}]}
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
