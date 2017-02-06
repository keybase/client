// @flow
import React from 'react'
import {Box, Checkbox, Divider, Icon} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../styles'
import Participants from './participants.desktop'

import type {Props} from '.'

const border = `1px solid ${globalColors.black_05}`
const SidePanel = (props: Props) => (
  <Box style={{flex: 1, borderLeft: border, borderRight: border, backgroundColor: globalColors.white, marginTop: -1, overflowY: 'auto'}}>
    <Participants {...props} />

    <Divider style={{marginBottom: 20, marginTop: 20}} />

    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', borderLeft: border, borderRight: border}}>
      <Box style={{...globalStyles.flexBoxRow}}>
        <Checkbox checked={props.muted} onCheck={checked => props.onMuteConversation(checked)} label='Mute notifications' />
        <Icon type='icon-shh-active-16' style={{marginLeft: globalMargins.tiny}} />
      </Box>
    </Box>

    <Divider style={{marginBottom: 20, marginTop: 20}} />
  </Box>
)

export default SidePanel
