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
} from '../../../../common-adapters'
import {globalMargins, globalStyles, globalColors, isMobile} from '../../../../styles'
import {roleIconColorMap} from '../../../role-picker/index.meta'
import {typeToLabel} from '../../../../constants/teams'
import {type TypeMap} from '../../../../constants/types/teams'

export type Props = {
  active: boolean,
  youCanManageMembers: boolean,
  following: boolean,
  fullName: string,
  onChat: () => void,
  onClick: () => void,
  onReAddToTeam: () => void,
  onRemoveFromTeam: () => void,
  type: ?string,
  username: string,
  you: ?string,
}

const showCrown: TypeMap = {
  admin: true,
  owner: true,
  reader: false,
  writer: false,
}

export const TeamMemberRow = (props: Props) => {
  const {
    active,
    youCanManageMembers,
    following,
    fullName,
    onChat,
    onClick,
    type,
    username,
    you,
    onReAddToTeam,
    onRemoveFromTeam,
  } = props
  let crown, fullNameLabel, resetLabel
  if (active && type && showCrown[type]) {
    crown = (
      <Icon
        // $FlowIssue "some string with unknown value"
        type={'iconfont-crown-' + type}
        style={{
          color: roleIconColorMap[type],
          fontSize: isMobile ? 16 : 12,
          marginRight: globalMargins.xtiny,
        }}
      />
    )
  }
  if (fullName && active) {
    fullNameLabel = (
      <Text style={{marginRight: globalMargins.xtiny}} type="BodySmall">
        {fullName} •
      </Text>
    )
  }
  if (!active) {
    resetLabel = youCanManageMembers
      ? 'Has reset their account'
      : 'Has reset their account; admins can re-invite'
  }
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
            {!active && (
              <Meta
                title="LOCKED OUT"
                style={{background: globalColors.red, marginLeft: globalMargins.xtiny, marginTop: 4}}
              />
            )}
          </Box>
          <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
            {fullNameLabel}
            {crown}
            <Text type="BodySmall">
              {!!active && !!type && typeToLabel[type]}
              {resetLabel}
            </Text>
          </Box>
        </Box>
      </ClickableBox>
      {!active &&
        youCanManageMembers && (
          <Box style={{...globalStyles.flexBoxRow, flexShrink: 1}}>
            <ButtonBar>
              <Button small={true} label="Admit" onClick={onReAddToTeam} type="Primary" />
              <Button small={true} label="Remove" onClick={onRemoveFromTeam} type="Secondary" />
            </ButtonBar>
          </Box>
        )}
      {(active || !isMobile) && (
        <Box style={{...globalStyles.flexBoxRow, flexShrink: 1}}>
          <Icon
            onClick={onChat}
            style={{
              fontSize: isMobile ? 20 : 16,
              marginLeft: globalMargins.small,
              marginRight: globalMargins.tiny,
            }}
            type="iconfont-chat"
          />
        </Box>
      )}
    </Box>
  )
}
