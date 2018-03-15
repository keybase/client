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
} from '../../../../common-adapters'
import {globalMargins, globalStyles, globalColors, isMobile} from '../../../../styles'
import {roleIconColorMap} from '../../../role-picker/index.meta'
import {typeToLabel} from '../../../../constants/teams'
import {type BoolTypeMap, type TeamRoleType} from '../../../../constants/types/teams'

export type Props = {
  active: boolean,
  youCanManageMembers: boolean,
  following: boolean,
  fullName: string,
  onChat: () => void,
  onClick: () => void,
  onReAddToTeam: () => void,
  onRemoveFromTeam: () => void,
  onShowTracker: () => void,
  roleType: ?TeamRoleType,
  username: string,
  you: ?string,
}

const showCrown: BoolTypeMap = {
  reset: false,
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
    roleType,
    username,
    you,
    onReAddToTeam,
    onRemoveFromTeam,
    onShowTracker,
  } = props
  let crown, fullNameLabel, resetLabel
  if (active && roleType && showCrown[roleType]) {
    crown = (
      <Icon
        // $FlowIssue "some string with unknown value"
        type={'iconfont-crown-' + roleType}
        style={{
          color: roleIconColorMap[roleType],
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
    <Box style={active ? stylesContainer : stylesContainerReset}>
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
          style={{
            ...globalStyles.flexBoxRow,
            flexGrow: 1,
            alignItems: 'center',
          }}
          onClick={active || isMobile ? onClick : onShowTracker}
        >
          <Avatar username={username} size={isMobile ? 48 : 32} />
          <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.small}}>
            <Box style={globalStyles.flexBoxRow}>
              <Usernames
                type="BodySemibold"
                colorFollowing={true}
                users={[{username, following, you: you === username}]}
              />
            </Box>
            <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
              {fullNameLabel}
              {crown}
              {!active && (
                <Text
                  type="BodySmall"
                  style={{
                    ...globalStyles.fontBold,
                    color: globalColors.white,
                    backgroundColor: globalColors.red,
                    marginRight: globalMargins.xtiny,
                    paddingLeft: globalMargins.xtiny,
                    paddingRight: globalMargins.xtiny,
                  }}
                >
                  LOCKED OUT
                </Text>
              )}
              <Text type="BodySmall">
                {!!active && !!roleType && typeToLabel[roleType]}
                {resetLabel}
              </Text>
            </Box>
          </Box>
        </ClickableBox>
        {!active &&
          !isMobile &&
          youCanManageMembers && (
            <Box style={{...globalStyles.flexBoxRow, flexShrink: 1}}>
              <ButtonBar>
                <Button small={true} label="Re-Admit" onClick={onReAddToTeam} type="PrimaryGreen" />
                <Button small={true} label="Remove" onClick={onRemoveFromTeam} type="Secondary" />
              </ButtonBar>
            </Box>
          )}
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
      </Box>
      {!active &&
        isMobile &&
        youCanManageMembers && (
          <Box style={{...globalStyles.flexBoxRow, flexShrink: 1}}>
            <ButtonBar direction="row">
              <Button small={true} label="Re-Admit" onClick={onReAddToTeam} type="PrimaryGreen" />
              <Button small={true} label="Remove" onClick={onRemoveFromTeam} type="Secondary" />
            </ButtonBar>
          </Box>
        )}
    </Box>
  )
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  width: '100%',
  height: '100%',
  position: 'relative',
}

const stylesContainerReset = {
  ...stylesContainer,
  backgroundColor: globalColors.blue4,
}
