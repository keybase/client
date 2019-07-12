// TODO deprecate
import * as React from 'react'
import {Avatar, Box, Button, Meta, Text, Usernames, FloatingMenu} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles, isMobile, platformStyles} from '../../styles'

export type Props = {
  attachTo?: () => React.Component<any> | null
  description: string
  following: {[K in string]: true}
  memberCount: number
  onHidden: () => void
  onJoinTeam: (teamname: string) => void
  onUserClick: (username: string) => void
  openTeam: boolean
  publicAdmins: Array<string>
  publicAdminsOthers: number
  teamJoinError: string
  teamJoinSuccess: boolean
  teamname: string
  visible: boolean
  youAreInTeam: boolean
  youHaveRequestedAccess: boolean
}

const TeamInfo = (props: Props) => (
  <Box
    style={platformStyles({
      common: {
        ...globalStyles.flexBoxColumn,
        alignItems: 'center',
        textAlign: 'center',
      },
      isElectron: {
        width: 220,
      },
      isMobile: {
        paddingBottom: globalMargins.medium,
        paddingTop: globalMargins.medium,
      },
    })}
  >
    <Box
      style={{
        height: isMobile ? 64 : 48,
        marginBottom: globalMargins.xtiny,
        marginTop: isMobile ? globalMargins.tiny : globalMargins.small,
      }}
    >
      <Avatar teamname={props.teamname} size={isMobile ? 64 : 48} />
    </Box>
    <Text type="Header">{props.teamname}</Text>

    <Box style={globalStyles.flexBoxRow}>
      {props.openTeam && <Meta title="open" style={styleMeta} backgroundColor={globalColors.green} />}
    </Box>

    <Text type="BodySmall">{props.memberCount + ' member' + (props.memberCount !== 1 ? 's' : '')}</Text>

    <Text center={true} type="Body" style={styleDescription}>
      {props.description}
    </Text>

    {!!props.teamJoinError && (
      <Text center={true} type="BodySmall" style={styleDescription}>
        Error: {props.teamJoinError}
      </Text>
    )}

    {!props.youAreInTeam && (
      <Box style={styleDivider}>
        <Button
          fullWidth={true}
          onClick={() => props.onJoinTeam(props.teamname)}
          disabled={props.teamJoinSuccess || props.youHaveRequestedAccess}
          label={
            props.teamJoinSuccess || props.youHaveRequestedAccess
              ? props.openTeam
                ? 'Joined'
                : 'Request sent'
              : props.openTeam
              ? 'Join team'
              : 'Request to join'
          }
          small={!isMobile}
          style={{marginTop: globalMargins.tiny}}
          type={
            props.teamJoinSuccess || props.youHaveRequestedAccess
              ? props.openTeam
                ? 'Success'
                : 'Dim'
              : props.openTeam
              ? 'Success'
              : 'Default'
          }
        />
      </Box>
    )}

    {!props.youAreInTeam && props.youHaveRequestedAccess && props.openTeam && (
      <Box center={true} style={styleDescription}>
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
                : props.publicAdminsOthers === 0
                ? '.'
                : `, + ${props.publicAdminsOthers} others.`}
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
  marginLeft: globalMargins.xtiny,
  marginTop: 2,
} as const

const styleWrap = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  alignSelf: 'center',
  flexWrap: 'wrap',
  justifyContent: 'flex-start',
  marginBottom: isMobile ? 0 : globalMargins.small,
  marginLeft: globalMargins.small,
  marginRight: globalMargins.small,
  marginTop: globalMargins.tiny,
  textAlign: 'center',
}

const TeamInfoWrapper = (props: Props) => {
  const header = {
    title: 'header',
    view: <TeamInfo {...props} />,
  }
  return (
    <FloatingMenu
      attachTo={props.attachTo}
      closeOnSelect={false}
      onHidden={props.onHidden}
      visible={props.visible}
      header={header}
      position="bottom left"
      containerStyle={isMobile ? {} : {zIndex: 3}} // over zIndex that's set on user bio
      items={[]}
    />
  )
}

export default TeamInfoWrapper
