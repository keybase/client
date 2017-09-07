// @flow
import * as React from 'react'
import {
  Avatar,
  Box,
  Button,
  Checkbox,
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
      }),
}
const contentContainerStyle = {...globalStyles.flexBoxColumn, alignItems: 'stretch', paddingBottom: 20}

type MuteRowProps = {
  muted: boolean,
  onMute: (muted: boolean) => void,
  label: string,
}

const MuteRow = (props: MuteRowProps) => (
  <Box style={{...globalStyles.flexBoxRow, alignSelf: 'center'}}>
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
        marginLeft: globalMargins.tiny,
        ...(isMobile ? {fontSize: 24} : {}),
      }}
    />
  </Box>
)

type infoPanelProps = {
  muted: boolean,
  onAddParticipant: () => void,
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

type SmallTeamInfoPanelProps = infoPanelProps & {
  onShowBlockConversationDialog: () => void,
  onShowNewTeamDialog: () => void,
  showTeamButton: boolean,
}

const _SmallTeamInfoPanel = (props: SmallTeamInfoPanelProps) => (
  <ScrollView style={scrollViewStyle} contentContainerStyle={contentContainerStyle}>
    <Participants
      participants={props.participants}
      onAddParticipant={null /* off until this works */}
      onShowProfile={props.onShowProfile}
    />

    <Divider style={{marginBottom: 20, marginTop: props.showTeamButton ? 10 : 20}} />

    {props.showTeamButton
      ? <Button type="Primary" label="Turn into team" onClick={props.onShowNewTeamDialog} />
      : null}

    {props.showTeamButton
      ? <Text style={{alignSelf: 'center', marginTop: globalMargins.tiny}} type="BodySmall">
          You'll be able to add and delete members as you wish.
        </Text>
      : null}

    {props.showTeamButton ? <Divider style={styleDivider} /> : null}

    <MuteRow muted={props.muted} onMute={props.onMuteConversation} label="Mute notifications" />

    <Notifications />

    <Divider style={styleDivider} />

    <Button type="Danger" label="Block this conversation" onClick={props.onShowBlockConversationDialog} />
  </ScrollView>
)

type BigTeamInfoPanelProps = infoPanelProps & {
  channelname: string,
  onLeaveConversation: () => void,
  teamname: string,
}

const _BigTeamInfoPanel = (props: BigTeamInfoPanelProps) => (
  <ScrollView style={scrollViewStyle} contentContainerStyle={contentContainerStyle}>
    <Text style={{alignSelf: 'center', marginTop: 20}} type="BodySemibold">
      #{props.channelname}
    </Text>

    <Box style={{...globalStyles.flexBoxRow, alignSelf: 'center'}}>
      <Avatar teamname={props.teamname} size={16} />
      <Text style={{marginLeft: globalMargins.xtiny}} type="BodySmall">
        {props.teamname}
      </Text>
    </Box>

    <Divider style={styleDivider} />

    <MuteRow muted={props.muted} onMute={props.onMuteConversation} label="Mute channel" />

    <Notifications />

    <Divider style={styleDivider} />

    <Button type="Danger" label="Leave channel" onClick={props.onLeaveConversation} />

    <Divider style={styleDivider} />

    <Text style={{paddingLeft: globalMargins.small}} type="BodySmall">
      Members
    </Text>

    <Participants
      participants={props.participants}
      onAddParticipant={null /* until this works TODO */}
      onShowProfile={props.onShowProfile}
    />
  </ScrollView>
)

const wrap = branch(() => isMobile, HeaderHoc)
const SmallTeamInfoPanel = wrap(_SmallTeamInfoPanel)
const BigTeamInfoPanel = wrap(_BigTeamInfoPanel)

const styleDivider = {
  marginBottom: 20,
  marginTop: 20,
}

export {SmallTeamInfoPanel, BigTeamInfoPanel, MuteRow}
