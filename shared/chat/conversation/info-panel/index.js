// @flow
import * as React from 'react'
import {
  Avatar,
  Box,
  Button,
  ButtonBar,
  Checkbox,
  ClickableBox,
  Divider,
  HeaderHoc,
  Icon,
  List,
  ScrollView,
  Text,
} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../../styles'
import {branch} from 'recompose'
import Notifications from './notifications/container'
import Participants, {RenderParticipant} from './participants'

const border = `1px solid ${globalColors.black_05}`
const scrollViewStyle = {
  flex: 1,
  ...(isMobile
    ? {}
    : {
        backgroundColor: globalColors.white,
        borderLeft: border,
        borderRight: border,
        marginTop: -1 /* Necessary fix: adds 1px at the top so we hide the gray divider */,
      }),
}
const contentContainerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'stretch',
  paddingBottom: globalMargins.medium,
}

type MuteRowProps = {
  muted: boolean,
  onMute: (muted: boolean) => void,
  label: string,
}

const MuteRow = (props: MuteRowProps) => (
  <Box
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      marginBottom: globalMargins.xtiny,
      marginLeft: globalMargins.small,
    }}
  >
    <Checkbox
      checked={props.muted}
      disabled={props.onMute == null}
      onCheck={props.onMute}
      label={props.label}
    />
    <Icon
      type="iconfont-shh"
      style={{
        color: globalColors.black_20,
        marginLeft: globalMargins.xtiny,
        ...(isMobile ? {fontSize: 24} : {}),
      }}
    />
  </Box>
)

type infoPanelProps = {
  admin: boolean,
  muted: boolean,
  onMuteConversation: (muted: boolean) => void,
  onShowProfile: (username: string) => void,
  onToggleInfoPanel: () => void,
  numberParticipants: number,
  participants: Array<{
    username: string,
    following: boolean,
    fullname: string,
    broken: boolean,
    isYou: boolean,
  }>,
}

type ConversationInfoPanelProps = infoPanelProps & {
  onShowBlockConversationDialog: () => void,
  onShowNewTeamDialog: () => void,
  showTeamButton: boolean,
}

const _ConversationInfoPanel = (props: ConversationInfoPanelProps) => (
  <ScrollView style={scrollViewStyle} contentContainerStyle={contentContainerStyle}>
    <Participants participants={props.participants} onShowProfile={props.onShowProfile} />

    <Divider style={{marginBottom: 20, marginTop: props.showTeamButton ? 10 : 20}} />

    {props.showTeamButton ? (
      <ButtonBar>
        <Button type="Primary" small={true} label="Turn into team" onClick={props.onShowNewTeamDialog} />
      </ButtonBar>
    ) : null}

    {props.showTeamButton ? (
      <Text
        style={{
          alignSelf: 'center',
          marginLeft: globalMargins.small,
          marginRight: globalMargins.small,
          marginTop: globalMargins.tiny,
          textAlign: 'center',
        }}
        type="BodySmall"
      >
        You'll be able to add and delete members as you wish.
      </Text>
    ) : null}

    {props.showTeamButton ? <Divider style={styleDivider} /> : null}

    <MuteRow muted={props.muted} onMute={props.onMuteConversation} label="Mute entire conversation" />

    <Notifications />

    <Divider style={styleDivider} />

    <Button
      type="Danger"
      small={true}
      label="Block this conversation"
      onClick={props.onShowBlockConversationDialog}
    />
  </ScrollView>
)

type SmallTeamInfoPanelProps = infoPanelProps & {
  onLeaveTeam: () => void,
  onViewTeam: () => void,
  teamname: string,
}

// TODO put leave team button back in once bugs are fixed
// const headerButtonBoxStyle = {
//   ...globalStyles.flexBoxRow,
//   alignItems: 'center',
//   alignSelf: 'center',
// }

// const createIconStyle = {
//   color: globalColors.red,
//   fontSize: isMobile ? 20 : 16,
// }

const _SmallTeamInfoPanel = (props: SmallTeamInfoPanelProps) => (
  <ScrollView style={scrollViewStyle} contentContainerStyle={contentContainerStyle}>
    <ClickableBox
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        marginLeft: globalMargins.small,
        marginTop: globalMargins.small,
      }}
      onClick={props.onViewTeam}
    >
      <Avatar size={isMobile ? 48 : 32} teamname={props.teamname} isTeam={true} />
      <Box style={{...globalStyles.flexBoxColumn, flex: 1, marginLeft: globalMargins.small}}>
        <Text type="BodySemibold">{props.teamname}</Text>
        <Box style={globalStyles.flexBoxRow}>
          <Text type="BodySmall">
            {props.participants.length.toString() + ' member' + (props.participants.length !== 1 ? 's' : '')}
          </Text>
        </Box>
      </Box>
    </ClickableBox>

    <Divider style={{marginBottom: 20, marginTop: 20}} />

    <MuteRow muted={props.muted} onMute={props.onMuteConversation} label="Mute all notifications" />

    <Notifications />
    {/* <Box style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'flex-end'}}>
      <Divider style={styleDivider} />
      <ClickableBox onClick={props.onLeaveTeam} style={headerButtonBoxStyle}>
        <Icon type="iconfont-team-leave" style={createIconStyle} />
        <Text type="BodyBigLink" style={{margin: globalMargins.xtiny, color: globalColors.red}}>
          Leave team
        </Text>
      </ClickableBox>
    </Box> */}
    <Divider style={styleDivider} />
    <Box style={{...globalStyles.flexBoxRow, marginRight: globalMargins.small}}>
      <Text style={{flex: 1, paddingLeft: globalMargins.small}} type="BodySmallSemibold">
        In this team ({props.participants.length.toString()})
      </Text>
      {props.admin && (
        <Text type="BodySmallPrimaryLink" onClick={props.onViewTeam}>
          Manage
        </Text>
      )}
    </Box>
    <Participants participants={props.participants} onShowProfile={props.onShowProfile} />
  </ScrollView>
)

type BigTeamInfoPanelProps = infoPanelProps & {
  onLeaveConversation: () => void,
  channelname: string,
  onJoinChannel: () => void,
  onViewTeam: () => void,
  teamname: string,
  isPreview: boolean,
}

type InfoPanelRow = BigTeamInfoPanelProps & {
  type: 'header' | 'notifications' | 'divider' | 'controls' | 'anyoneCanJoin',
}

type ParticipantRow = {
  type: 'participant',
  participant: {
    username: string,
    following: boolean,
    fullname: string,
    broken: boolean,
    isYou: boolean,
  },
  onShowProfile: string => void,
}

type BigTeamRow = InfoPanelRow | ParticipantRow

const _renderBigTeamRow = (i: number, props: BigTeamRow) => {
  switch (props.type) {
    case 'header':
      return (
        <Box style={{...globalStyles.flexBoxColumn, alignItems: 'stretch'}}>
          <Text style={{alignSelf: 'center', marginTop: globalMargins.medium}} type="BodyBig">
            #{props.channelname}
          </Text>

          <ClickableBox
            style={{...globalStyles.flexBoxRow, alignSelf: 'center', alignItems: 'center'}}
            onClick={props.onViewTeam}
          >
            <Avatar teamname={props.teamname} size={12} />
            <Text type="BodySmallSemibold" style={{marginLeft: globalMargins.xtiny}}>
              {props.teamname}
            </Text>
          </ClickableBox>
        </Box>
      )
    case 'notifications':
      return (
        <Box>
          <Divider style={styleDivider} />
          <MuteRow muted={props.muted} onMute={props.onMuteConversation} label="Mute entire channel" />
          <Notifications />
        </Box>
      )
    case 'divider':
      return <Divider style={styleDivider} />
    case 'controls':
      return (
        <Box style={{...globalStyles.flexBoxRow, justifyContent: 'center'}}>
          {props.isPreview && (
            <Button
              type="Primary"
              label="Join channel"
              style={{marginRight: globalMargins.xtiny}}
              small={true}
              onClick={props.onJoinChannel}
            />
          )}
          {!props.isPreview && (
            <Button type="Danger" small={true} label="Leave channel" onClick={props.onLeaveConversation} />
          )}
        </Box>
      )
    case 'anyoneCanJoin':
      return (
        <Text type="BodySmall" style={{textAlign: 'center', marginTop: globalMargins.xtiny}}>
          Anyone in {props.teamname} can join.
        </Text>
      )
    case 'participant':
      return <RenderParticipant participant={props.participant} onShowProfile={props.onShowProfile} />
  }
}

const _BigTeamInfoPanel = (props: BigTeamInfoPanelProps) => {
  const {isPreview} = props
  const rows: Array<BigTeamRow> = [
    {
      ...props,
      type: 'header',
    },
  ]
  if (!isPreview) {
    rows.push({...props, type: 'notifications'})
  }
  rows.push({...props, type: 'divider'}, {...props, type: 'controls'})
  if (isPreview) {
    rows.push({...props, type: 'anyoneCanJoin'})
  }
  props.participants.forEach(participant =>
    rows.push({onShowProfile: props.onShowProfile, type: 'participant', participant})
  )

  return (
    <List
      items={rows}
      renderItem={_renderBigTeamRow}
      style={{
        ...contentContainerStyle,
        ...scrollViewStyle,
      }}
    />
  )
}

const wrap = branch(() => isMobile, HeaderHoc)
const ConversationInfoPanel = wrap(_ConversationInfoPanel)
const SmallTeamInfoPanel = wrap(_SmallTeamInfoPanel)
const BigTeamInfoPanel = wrap(_BigTeamInfoPanel)

const styleDivider = {
  marginBottom: globalMargins.small,
  marginTop: globalMargins.small,
}

export {ConversationInfoPanel, SmallTeamInfoPanel, BigTeamInfoPanel, MuteRow}
