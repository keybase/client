// @flow
import * as React from 'react'
import {
  Avatar,
  Box,
  Button,
  ButtonBar,
  ClickableBox,
  Text,
  Icon,
  Usernames,
  Meta,
} from '../../../common-adapters'
import {globalMargins, globalStyles, globalColors, isMobile} from '../../../styles'
import {roleIconColorMap} from '../../role-picker/index.meta'
import {typeToLabel} from '../../../constants/teams'
import {type TypeMap} from '../../../constants/types/teams'

export type Props = {
  username: string,
  following: boolean,
  teamname: string,
  you: ?string,
  type: ?string,
  active: boolean,
  onClick: () => void,
  onReAddToTeam: () => void,
  onRemoveFromTeam: () => void,
}

const showCrown: TypeMap = {
  admin: true,
  owner: true,
  reader: false,
  writer: false,
}

export const TeamMemberRow = (props: Props) => {
  const {username, onClick, you, following, type, active, onReAddToTeam, onRemoveFromTeam} = props
  return (
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        flexShrink: 0,
        height: isMobile ? 56 : 48,
        padding: globalMargins.tiny,
        width: '100%',
      }}
    >
      <ClickableBox
        style={{...globalStyles.flexBoxRow, flexGrow: 1, alignItems: 'center'}}
        onClick={active ? onClick : undefined}
      >
        <Avatar username={username} size={isMobile ? 48 : 32} />
        <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.small}}>
          <Box style={globalStyles.flexBoxRow}>
            <Usernames
              type="BodySemibold"
              colorFollowing={true}
              users={[{username, following, you: you === username}]}
            />
            {!active &&
              <Meta
                title="LOCKED OUT"
                style={{background: globalColors.red, marginLeft: globalMargins.xtiny, marginTop: 4}}
              />}
          </Box>
          <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
            {!!active &&
              !!type &&
              !!showCrown[type] &&
              <Icon
                // $FlowIssue "some string with unknown value"
                type={'iconfont-crown-' + type}
                style={{
                  color: roleIconColorMap[type],
                  fontSize: isMobile ? 16 : 12,
                  marginRight: globalMargins.xtiny,
                }}
              />}
            <Text type="BodySmall">
              {!!active && !!type && typeToLabel[type]}
              {!active && 'Has reset their account'}
            </Text>
          </Box>
        </Box>
      </ClickableBox>
      {!active &&
        <Box style={{...globalStyles.flexBoxRow, flexShrink: 1}}>
          <ButtonBar>
            <Button small={true} label="Admit" onClick={onReAddToTeam} type="Primary" />
            <Button small={true} label="Remove" onClick={onRemoveFromTeam} type="Secondary" />
          </ButtonBar>
        </Box>}
    </Box>
  )
}
