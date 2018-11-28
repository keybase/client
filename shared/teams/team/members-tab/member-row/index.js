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
import {isLargeScreen} from '../../../../constants/platform'
import type {BoolTypeMap, MemberStatus, TeamRoleType} from '../../../../constants/types/teams'

export type Props = {
  following: boolean,
  fullName: string,
  onChat: () => void,
  onClick: () => void,
  onReAddToTeam: () => void,
  onRemoveFromTeam: () => void,
  onShowTracker: () => void,
  roleType: TeamRoleType,
  status: MemberStatus,
  username: string,
  waitingForAdd: boolean,
  waitingForRemove: boolean,
  you: string,
  youCanManageMembers: boolean,
}

const showCrown: BoolTypeMap = {
  admin: true,
  owner: true,
  reader: false,
  writer: false,
}

// NOTE the controls for reset and deleted users (and the chat button) are
// duplicated here because the desktop & mobile layouts differ significantly. If
// you're changing one remember to change the other.

export const TeamMemberRow = (props: Props) => {
  let crown, fullNameLabel, resetLabel
  const active = props.status === 'active'
  if (active && props.roleType && showCrown[props.roleType]) {
    crown = (
      <Icon
        // $FlowIssue "some string with unknown value"
        type={'iconfont-crown-' + props.roleType}
        style={{
          marginRight: globalMargins.xtiny,
        }}
        color={roleIconColorMap[props.roleType]}
        fontSize={isMobile ? 16 : 12}
      />
    )
  }
  if (props.fullName && active) {
    fullNameLabel = (
      <Text style={{marginRight: globalMargins.xtiny}} type="BodySmall">
        {props.fullName} •
      </Text>
    )
  }
  if (!active) {
    resetLabel = props.youCanManageMembers
      ? 'Has reset their account'
      : 'Has reset their account; admins can re-invite'
    if (props.status === 'deleted') {
      resetLabel = 'Has deleted their account'
    }
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
          onClick={active ? props.onClick : props.status === 'deleted' ? null : props.onShowTracker}
        >
          <Avatar username={props.username} size={isMobile ? 48 : 32} />
          <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.small}}>
            <Box style={globalStyles.flexBoxRow}>
              <Usernames
                type="BodySemibold"
                colorFollowing={true}
                users={[
                  {username: props.username, following: props.following, you: props.you === props.username},
                ]}
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
                  {props.status === 'reset' ? 'LOCKED OUT' : 'DELETED'}
                </Text>
              )}
              <Text type="BodySmall">
                {!!active && !!props.roleType && typeToLabel[props.roleType]}
                {resetLabel}
              </Text>
            </Box>
          </Box>
        </ClickableBox>
        {!active && !isMobile && props.youCanManageMembers && (
          <Box style={{...globalStyles.flexBoxRow, flexShrink: 1}}>
            <ButtonBar>
              {props.status !== 'deleted' && (
                <Button
                  small={true}
                  label="Re-Admit"
                  onClick={props.onReAddToTeam}
                  type="PrimaryGreen"
                  waiting={props.waitingForAdd}
                  disabled={props.waitingForRemove}
                />
              )}
              <Button
                small={true}
                label="Remove"
                onClick={props.onRemoveFromTeam}
                type="Secondary"
                waiting={props.waitingForRemove}
                disabled={props.waitingForAdd}
              />
            </ButtonBar>
          </Box>
        )}
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', flexShrink: 1, height: '100%'}}>
          {(active || isLargeScreen) && (
            // Desktop & mobile large screen - display on the far right of the first row
            // Also when user is active
            <Icon
              onClick={props.onChat}
              style={isMobile ? stylesChatButtonMobile(active) : stylesChatButtonDesktop}
              fontSize={isMobile ? 20 : 16}
              type="iconfont-chat"
            />
          )}
        </Box>
      </Box>
      {!active && isMobile && props.youCanManageMembers && (
        <Box style={{...globalStyles.flexBoxRow, flexShrink: 1}}>
          <ButtonBar direction="row">
            {props.status !== 'deleted' && (
              <Button
                small={true}
                label="Re-Admit"
                onClick={props.onReAddToTeam}
                type="PrimaryGreen"
                waiting={props.waitingForAdd}
                disabled={props.waitingForRemove}
              />
            )}
            <Button
              small={true}
              label="Remove"
              onClick={props.onRemoveFromTeam}
              type="Secondary"
              waiting={props.waitingForRemove}
              disabled={props.waitingForAdd}
            />
          </ButtonBar>
          {!isLargeScreen && (
            // Mobile small screens - for inactive user
            // display next to reset / deleted controls
            <Icon
              onClick={props.onChat}
              style={stylesChatButtonMobile(active)}
              fontSize={20}
              type="iconfont-chat"
            />
          )}
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

const stylesChatButtonDesktop = {
  marginLeft: globalMargins.small,
  marginRight: globalMargins.tiny,
  padding: globalMargins.tiny,
}

const stylesChatButtonMobile = (active: boolean) => ({
  position: 'absolute',
  right: 16,
  top: isLargeScreen || active ? 12 : 24,
})
