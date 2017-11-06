// @flow
import * as React from 'react'
import {Avatar, Box, Button, ClickableBox, Text, Usernames} from '../../../common-adapters'
import {globalStyles, globalMargins} from '../../../styles'
import {isMobile} from '../../../constants/platform'
import {typeToLabel} from '../../../constants/teams'

export type Props = {
  email?: string, // email invite
  name?: string, // seitan invite
  username?: string, // sbs invite
  onCancelInvite: () => void,
  following: boolean,
  teamname: string,
  role: string,
  you: ?string,
  id: string,
}

export const TeamInviteRow = (props: Props) => {
  const {following, onCancelInvite, role, you} = props
  const user = props.email || props.username || props.name || ''
  const username = props.username || ''
  return (
    <ClickableBox
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        flexShrink: 0,
        height: isMobile ? 56 : 48,
        padding: globalMargins.tiny,
        width: '100%',
      }}
    >
      <Box style={{...globalStyles.flexBoxRow, flexGrow: 1}}>
        <Avatar username={username} size={isMobile ? 48 : 32} />
        <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.small}}>
          <Usernames
            type="BodySemibold"
            colorFollowing={true}
            users={[{following, username: user, you: you === username}]}
          />
          <Box style={globalStyles.flexBoxRow}>
            <Text type="BodySmall">{role && typeToLabel[role]}</Text>
          </Box>
        </Box>
      </Box>
      <Box style={{...globalStyles.flexBoxRow, flexShrink: 1}}>
        <Button
          small={true}
          label={isMobile ? 'Cancel' : 'Cancel invite'}
          onClick={onCancelInvite}
          type="Secondary"
        />
      </Box>
    </ClickableBox>
  )
}
