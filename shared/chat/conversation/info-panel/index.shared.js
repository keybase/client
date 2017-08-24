// @flow
import * as React from 'react'
import {Box, Button, Checkbox, Divider, Icon} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../styles'

import {isMobile} from '../../../constants/platform'

import Participants from './participants'

import type {Props} from '.'

const InfoPanelContents = (props: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'stretch'}}>
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
  </Box>
)

export default InfoPanelContents
