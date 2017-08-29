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

const _SmallTeamInfoPanel = (props: SmallTeamInfoPanelProps) => (
  <ScrollView
    style={scrollViewStyle}
    contentContainerStyle={{...globalStyles.flexBoxColumn, alignItems: 'stretch', paddingBottom: 20}}
  >
    <Participants
      participants={props.participants}
      onAddParticipant={props.onAddParticipant}
      onShowProfile={props.onShowProfile}
    />

    <Divider style={{marginBottom: 20, marginTop: 20}} />

    <Box style={{...globalStyles.flexBoxRow, alignSelf: 'center'}}>
      <Checkbox
        checked={props.muted}
        disabled={props.onMuteConversation == null}
        onCheck={checked => props.onMuteConversation(checked)}
        label="Mute notifications"
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

    <Divider style={{marginBottom: 20, marginTop: 20}} />

    <Button type="Danger" label="Block this conversation" onClick={props.onShowBlockConversationDialog} />
  </ScrollView>
)

const _BigTeamInfoPanel = (props: BigTeamInfoPanelProps) => (
  <ScrollView
    style={scrollViewStyle}
    contentContainerStyle={{...globalStyles.flexBoxColumn, alignItems: 'stretch', paddingBottom: 20}}
  >
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

    <Box style={{...globalStyles.flexBoxRow, alignSelf: 'center'}}>
      <Checkbox
        checked={props.muted}
        disabled={props.onMuteConversation == null}
        onCheck={checked => props.onMuteConversation(checked)}
        label="Mute channel"
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

const SmallTeamInfoPanel = branch(() => isMobile, HeaderHoc)(_SmallTeamInfoPanel)
const BigTeamInfoPanel = branch(() => isMobile, HeaderHoc)(_BigTeamInfoPanel)

export {SmallTeamInfoPanel, BigTeamInfoPanel}
