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

import Participants from './participants'

import type {SmallTeamInfoPanelProps, BigTeamInfoPanelProps} from '.'

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

type muteRowProps = {
  muted: boolean,
  onMute: (muted: boolean) => void,
  label: string,
}

const MuteRow = (props: muteRowProps) => (
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

const _SmallTeamInfoPanel = (props: SmallTeamInfoPanelProps) => (
  <ScrollView style={scrollViewStyle} contentContainerStyle={contentContainerStyle}>
    <Participants
      participants={props.participants}
      onAddParticipant={props.onAddParticipant}
      onShowProfile={props.onShowProfile}
    />

    <Divider style={{marginBottom: 20, marginTop: 20}} />

    <Button type="Primary" label="Turn into team" onClick={props.onShowNewTeamDialog} />

    <Divider style={{marginBottom: 20, marginTop: 20}} />

    <MuteRow muted={props.muted} onMute={props.onMuteConversation} label="Mute notifications" />

    <Divider style={{marginBottom: 20, marginTop: 20}} />

    <Button type="Danger" label="Block this conversation" onClick={props.onShowBlockConversationDialog} />
  </ScrollView>
)

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

    <Divider style={{marginBottom: 20, marginTop: 20}} />

    <MuteRow muted={props.muted} onMute={props.onMuteConversation} label="Mute channel" />

    <Divider style={{marginBottom: 20, marginTop: 20}} />

    <Text style={{paddingLeft: globalMargins.small}} type="BodySmall">
      Members
    </Text>

    <Participants
      participants={props.participants}
      onAddParticipant={props.onAddParticipant}
      onShowProfile={props.onShowProfile}
    />
  </ScrollView>
)

const wrap = branch(() => isMobile, HeaderHoc)
const SmallTeamInfoPanel = wrap(_SmallTeamInfoPanel)
const BigTeamInfoPanel = wrap(_BigTeamInfoPanel)

export {SmallTeamInfoPanel, BigTeamInfoPanel}
