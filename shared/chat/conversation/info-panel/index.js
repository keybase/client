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
      alignSelf: 'flex-start',
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
      ? <Button type="Primary" small={true} label="Turn into team" onClick={props.onShowNewTeamDialog} />
      : null}

    {props.showTeamButton
      ? <Text style={{alignSelf: 'center', marginTop: globalMargins.tiny}} type="BodySmall">
          You'll be able to add and delete members as you wish.
        </Text>
      : null}

    {props.showTeamButton ? <Divider style={styleDivider} /> : null}

    <MuteRow muted={props.muted} onMute={props.onMuteConversation} label="Mute conversation" />

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

type BigTeamInfoPanelProps = infoPanelProps & {
  channelname: string,
  onLeaveConversation: () => void,
  teamname: string,
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

    <Divider style={styleDivider} />

    <MuteRow muted={props.muted} onMute={props.onMuteConversation} label="Mute channel" />

    <Notifications />

    <Divider style={styleDivider} />

    <Button type="Danger" small={true} label="Leave channel" onClick={props.onLeaveConversation} />

    <Divider style={styleDivider} />

    <Text style={{paddingLeft: globalMargins.small}} type="BodySmallSemibold">
      Members
    </Text>
    <Text
      style={{alignSelf: 'center', paddingBottom: globalMargins.xtiny, paddingTop: globalMargins.tiny}}
      type="BodySmall"
    >
      Use @mentions to invite people to join.
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
  marginBottom: globalMargins.small,
  marginTop: globalMargins.small,
}

export {SmallTeamInfoPanel, BigTeamInfoPanel, MuteRow}
