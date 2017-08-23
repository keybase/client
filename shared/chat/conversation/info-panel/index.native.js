// @flow
import * as React from 'react'
import {
  Button,
  Box,
  Checkbox,
  Divider,
  Icon,
  HeaderHoc,
  NativeScrollView,
} from '../../../common-adapters/index.native'
import {globalColors, globalMargins, globalStyles} from '../../../styles'
import Participants from './participants'

import type {Props} from '.'

const InfoPanelContents = (props: Props) => (
  <NativeScrollView style={{flex: 1, width: '100%'}}>
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
        style={{marginLeft: globalMargins.tiny, fontSize: 24, color: globalColors.black_20}}
      />
    </Box>

    <Divider style={{marginBottom: 20, marginTop: 20}} />

    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
      <Button type="Danger" label="Block this conversation" onClick={props.onShowBlockConversationDialog} />
    </Box>
  </NativeScrollView>
)

const InfoPanel = HeaderHoc(InfoPanelContents)

export default InfoPanel
