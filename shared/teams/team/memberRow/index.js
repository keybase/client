// @flow
import * as React from 'react'
import {Avatar, Box, ClickableBox, Text, Icon} from '../../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../../styles'
import {isMobile} from '../../../constants/platform'

// For use in list RowRenderer prop
export type Props = {
  username: string,
  teamname: string,
  you: ?string,
  type: ?string,
  onOpenProfile: (u: string) => void,
}

const typeToLabel = {
  admins: 'Admin',
  owners: 'Owner',
  readers: 'Reader',
  writers: 'Writer',
}

const showCrown = {
  admins: true,
  owners: true,
  readers: false,
  writers: false,
}

export const TeamMemberRow = (props: Props) => {
  return (
    <ClickableBox
      key={props.username}
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        flexShrink: 0,
        height: isMobile ? 56 : 48,
        padding: globalMargins.tiny,
        width: '100%',
      }}
      onClick={() => props.onOpenProfile(props.username)}
    >
      <Avatar username={props.username} size={isMobile ? 48 : 32} />
      <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.small}}>
        <Text type={props.you === props.username ? 'BodySemiboldItalic' : 'BodySemibold'}>
          {props.username}
        </Text>
        <Box style={globalStyles.flexBoxRow}>
          {props.type &&
            !!showCrown[props.type] &&
            <Icon
              type="iconfont-crown"
              style={{
                color: globalColors.black_40,
                fontSize: isMobile ? 16 : 12,
                marginRight: globalMargins.xtiny,
              }}
            />}
          <Text type="BodySmall">{props.type && typeToLabel[props.type]}</Text>
        </Box>
      </Box>
    </ClickableBox>
  )
}
