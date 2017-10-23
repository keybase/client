// @flow
import * as React from 'react'
import {Avatar, Box, ClickableBox, Text, Usernames} from '../../../common-adapters'
import {globalStyles, globalMargins} from '../../../styles'
import {isMobile} from '../../../constants/platform'
import {typeToLabel} from '../../../constants/teams'

export type Props = {
  username: string,
  following: boolean,
  teamname: string,
  you: ?string,
  type: ?string,
}

export const TeamInviteRow = (props: Props) => {
  const {username, you, following, type} = props
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
      <Avatar username={username} size={isMobile ? 48 : 32} />
      <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.small}}>
        <Usernames
          type="BodySemibold"
          colorFollowing={true}
          users={[{username, following, you: you === username}]}
        />
        <Box style={globalStyles.flexBoxRow}>
          <Text type="BodySmall">{type && typeToLabel[type]}</Text>
        </Box>
      </Box>
    </ClickableBox>
  )
}
