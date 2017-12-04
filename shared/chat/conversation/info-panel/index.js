// @flow
import * as React from 'react'
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  ClickableBox,
  Divider,
  HeaderHoc,
  Icon,
  ScrollView,
  Text,
} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../styles'
import {isMobile} from '../../../constants/platform'
import {branch} from 'recompose'

import Notifications from './notifications/container'
import Participants from './participants'

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
  muted: boolean,
  onMuteConversation: (muted: boolean) => void,
  onShowProfile: (username: string) => void,
  onToggleInfoPanel: () => void,
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

    {props.showTeamButton
      ? <Button type="Primary" small={true} label="Turn into team" onClick={props.onShowNewTeamDialog} />
      : null}

    {props.showTeamButton
      ? <Text
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
      : null}

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

const headerButtonBoxStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  alignSelf: 'center',
}

const createIconStyle = {
  color: globalColors.red,
  fontSize: isMobile ? 20 : 16,
}

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
        <Text type="BodySemibold">
          {props.teamname}
        </Text>
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
    <Box style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'flex-end'}}>
      <Divider style={styleDivider} />
      <ClickableBox onClick={props.onLeaveTeam} style={headerButtonBoxStyle}>
        <Icon type="iconfont-team-leave" style={createIconStyle} />
        <Text type="BodyBigLink" style={{margin: globalMargins.xtiny, color: globalColors.red}}>
          Leave team
        </Text>
      </ClickableBox>
    </Box>
    <Divider style={styleDivider} />
    <Participants participants={props.participants} onShowProfile={props.onShowProfile} />

  </ScrollView>
)

type BigTeamInfoPanelProps = infoPanelProps & {
  onLeaveConversation: () => void,
  channelname: string,
  onJoinChannel: () => void,
  teamname: string,
  isPreview: boolean,
}

const _BigTeamInfoPanel = (props: BigTeamInfoPanelProps) => (
  <ScrollView style={scrollViewStyle} contentContainerStyle={contentContainerStyle}>
    <Text style={{alignSelf: 'center', marginTop: 20}} type="BodyBig">
      #{props.channelname}
    </Text>

    <Box style={{...globalStyles.flexBoxRow, alignSelf: 'center', alignItems: 'center'}}>
      <Avatar teamname={props.teamname} size={12} />
      <Text style={{marginLeft: globalMargins.xtiny}} type="BodySmallSemibold">
        {props.teamname}
      </Text>
    </Box>

    {!props.isPreview &&
      <Box>
        <Divider style={styleDivider} />
        <MuteRow muted={props.muted} onMute={props.onMuteConversation} label="Mute entire channel" />
        <Notifications />
      </Box>}

    <Divider style={styleDivider} />

    <Box style={{...globalStyles.flexBoxRow, justifyContent: 'center'}}>
      {props.isPreview &&
        <Button
          type="Primary"
          label="Join channel"
          style={{marginRight: globalMargins.xtiny}}
          small={true}
          onClick={props.onJoinChannel}
        />}
      <Button type="Danger" small={true} label="Leave channel" onClick={props.onLeaveConversation} />
    </Box>

    {props.isPreview &&
      <Text type="BodySmall" style={{textAlign: 'center', marginTop: globalMargins.xtiny}}>
        Anyone in {props.teamname} can join.
      </Text>}

    <Divider style={styleDivider} />

    <Text style={{paddingLeft: globalMargins.small}} type="BodySmallSemibold">
      Members
    </Text>
    <Participants participants={props.participants} onShowProfile={props.onShowProfile} />
  </ScrollView>
)

const wrap = branch(() => isMobile, HeaderHoc)
const ConversationInfoPanel = wrap(_ConversationInfoPanel)
const SmallTeamInfoPanel = wrap(_SmallTeamInfoPanel)
const BigTeamInfoPanel = wrap(_BigTeamInfoPanel)

const styleDivider = {
  marginBottom: globalMargins.small,
  marginTop: globalMargins.small,
}

export {ConversationInfoPanel, SmallTeamInfoPanel, BigTeamInfoPanel, MuteRow}
