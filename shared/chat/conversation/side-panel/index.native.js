// @flow
import React from 'react'
import {Box, Checkbox, Divider, Icon, PopupDialog, Text} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../styles'
import Participants from './participants'

import type {Props} from '.'

const SidePanel = (props: Props) => (
  <PopupDialog onClose={props.onToggleSidePanel} styleContainer={{...globalStyles.flexBoxCenter, flex: 0, padding: 10}}>
    <Divider style={{marginTop: 20}} />
    <Box style={{...globalStyles.flexBoxRow}}>
      <Participants {...props} />
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
  </PopupDialog>
)

export default SidePanel
