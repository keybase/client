// @flow
import * as React from 'react'
import {Avatar, Box, ClickableBox, Text, Icon, Usernames} from '../../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../../styles'
import {isMobile} from '../../../constants/platform'
import {typeToLabel, type TypeMap} from '../../../constants/teams'

export type Props = {
  username: string,
  following: boolean,
  teamname: string,
  you: ?string,
  type: ?string,
  onClick: () => void,
}

const showCrown: TypeMap = {
  admin: true,
  owner: true,
  reader: false,
  writer: false,
}

export const TeamMemberRow = (props: Props) => {
  const {username, onClick, you, following, type} = props
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
      onClick={onClick}
    >
      <Avatar username={username} size={isMobile ? 48 : 32} />
      <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.small}}>
        <Usernames
          type="BodySemibold"
          colorFollowing={true}
          users={[{username, following, you: you === username}]}
        />
        <Box style={globalStyles.flexBoxRow}>
          {type &&
            !!showCrown[type] &&
            <Icon
              type="iconfont-crown"
              style={{
                color: globalColors.black_40,
                fontSize: isMobile ? 16 : 12,
                marginRight: globalMargins.xtiny,
              }}
            />}
          <Text type="BodySmall">{type && typeToLabel[type]}</Text>
        </Box>
      </Box>
    </ClickableBox>
  )
}
