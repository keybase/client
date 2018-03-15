// @flow
import * as React from 'react'
import {Avatar, Box, Button, Meta, Text, Usernames} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../styles'
import PopupMenu, {ModalLessPopupMenu} from '../../common-adapters/popup-menu'
import type {Props} from '.'

const TeamInfo = (props: Props) => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      alignItems: 'center',
      textAlign: 'center',
    }}
  >
    <Box
      style={{
        height: isMobile ? 64 : 40,
        marginTop: isMobile ? globalMargins.tiny : globalMargins.small,
        marginBottom: globalMargins.xtiny,
      }}
    >
      <Avatar teamname={props.teamname} size={isMobile ? 64 : 40} />
    </Box>
    <Text type="Header">{props.teamname}</Text>

    <Box style={globalStyles.flexBoxRow}>
      <Text type="BodySmall">TEAM</Text>
      {props.openTeam && <Meta title="OPEN" style={styleMeta} />}
    </Box>

    <Text type="BodySmall">{props.memberCount + ' member' + (props.memberCount !== 1 ? 's' : '')}</Text>

    <Text type={'Body'} style={styleDescription}>
      {props.description}
    </Text>

    {!!props.teamJoinError && (
      <Text type="BodySmall" style={styleDescription}>
        Error: {props.teamJoinError}
      </Text>
    )}

    {!props.youAreInTeam && (
      <Box style={styleDivider}>
        <Button
          onClick={() => props.onJoinTeam(props.teamname)}
          disabled={props.teamJoinSuccess || props.youHaveRequestedAccess}
          label={
            props.teamJoinSuccess || props.youHaveRequestedAccess
              ? props.openTeam ? 'Joined' : 'Request sent'
              : props.openTeam ? 'Join team' : 'Request to join'
          }
          small={!isMobile}
          style={{marginTop: globalMargins.tiny}}
          type={
            props.teamJoinSuccess || props.youHaveRequestedAccess
              ? props.openTeam ? 'PrimaryGreen' : 'Secondary'
              : props.openTeam ? 'PrimaryGreen' : 'Primary'
          }
        />
      </Box>
    )}

    {!props.youAreInTeam &&
      props.youHaveRequestedAccess &&
      props.openTeam && (
        <Box style={styleDescription}>
          <Text type="BodySmall">As soon as an admin comes online, this team will unlock for you.</Text>
        </Box>
      )}

    {!!props.publicAdmins.length && (
      <Box style={styleWrap}>
        <Text type="BodySmall">Public admins: </Text>

        {props.publicAdmins.map((username, idx) => (
          <Box key={username} style={styleInnerWrap}>
            <Usernames
              type="BodySmallSemibold"
              underline={true}
              colorFollowing={true}
              users={[{following: !!props.following[username], username}]}
              onUsernameClicked={() => props.onUserClick(username)}
            />

            <Text type="BodySmall">
              {idx < props.publicAdmins.length - 1
                ? ', '
                : props.publicAdminsOthers === 0 ? '.' : `, + ${props.publicAdminsOthers} others.`}
            </Text>
          </Box>
        ))}
      </Box>
    )}
  </Box>
)

const styleDescription = {
  ...globalStyles.flexBoxRow,
  marginBottom: globalMargins.tiny,
  marginLeft: globalMargins.small,
  marginRight: globalMargins.small,
  marginTop: globalMargins.tiny,
  textAlign: 'center',
}

const styleDivider = {
  ...globalStyles.flexBoxRow,
  marginTop: globalMargins.tiny,
}

const styleInnerWrap = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  marginLeft: 2,
}

const styleMeta = {
  alignSelf: 'center',
  backgroundColor: globalColors.green,
  borderRadius: 1,
  marginLeft: globalMargins.xtiny,
  marginTop: 2,
}

const styleWrap = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  alignSelf: 'center',
  textAlign: 'center',
  flexWrap: 'wrap',
  marginLeft: globalMargins.small,
  marginRight: globalMargins.small,
  marginTop: globalMargins.tiny,
}

const TeamInfoWrapper = (props: Props) => {
  const header = {
    title: 'header',
    view: <TeamInfo {...(props: Props)} />,
  }
  let items = []

  return isMobile ? (
    <PopupMenu onHidden={props.onHidden} style={{overflow: 'visible'}} header={header} items={items} />
  ) : (
    <ModalLessPopupMenu
      onHidden={() => {}}
      style={{...props.style, overflow: 'visible', width: 220}}
      header={header}
      items={items}
    />
  )
}

export default TeamInfoWrapper
