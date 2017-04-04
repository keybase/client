// @flow
import React from 'react'
import {Button, Box, Checkbox, Divider, Icon, PopupDialog} from '../../../common-adapters'
import {NativeScrollView} from '../../../common-adapters/index.native'
import {globalMargins, globalStyles} from '../../../styles'
import Participants from './participants'

import type {Props} from '.'

const SidePanel = (props: Props) => (
  <PopupDialog onClose={props.onToggleSidePanel} styleContainer={{...globalStyles.flexBoxCenter, padding: 10}}>
    <NativeScrollView>
      <Divider style={{marginTop: 20}} />
      <Box style={{...globalStyles.flexBoxRow}}>
        <Participants participants={props.participants} onAddParticipant={props.onAddParticipant} onShowProfile={props.onShowProfile} />
      </Box>

      <Box style={{...globalStyles.flexBoxRow}}>
        <Divider style={{marginBottom: 20, marginTop: 20}} />
      </Box>

      <Box style={{...globalStyles.flexBoxRow, alignSelf: 'center'}}>
        <Checkbox checked={props.muted} onCheck={checked => props.onMuteConversation(checked)} label='Mute notifications' />
        <Icon type='icon-shh-active-16' style={{marginLeft: globalMargins.tiny}} />
      </Box>

      <Box style={{...globalStyles.flexBoxRow}}>
        <Divider style={{marginBottom: 20, marginTop: 20}} />
      </Box>

      <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
        <Button type='Danger' label='Block this conversation' onClick={() => props.onShowBlockConversationDialog()} />
      </Box>

      <Box style={{...globalStyles.flexBoxRow}}>
        <Divider style={{marginBottom: 20, marginTop: 20}} />
      </Box>
    </NativeScrollView>
  </PopupDialog>
)

export default SidePanel
