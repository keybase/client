// @flow
import React from 'react'
import {
  Button,
  Box,
  Checkbox,
  Divider,
  Icon,
  PopupDialog,
  HeaderHoc,
  NativeScrollView,
} from '../../../common-adapters/index.native'
import {globalColors, globalMargins, globalStyles} from '../../../styles'
import Participants from './participants'

import type {Props} from '.'

const _Contents = (props: Props) => (
  <NativeScrollView style={{flex: 1, width: '100%'}}>
    <Divider style={{marginTop: 20}} />
    <Box style={{...globalStyles.flexBoxRow, width: '100%', alignItems: 'stretch'}}>
      <Participants
        participants={props.participants}
        onAddParticipant={props.onAddParticipant}
        onShowProfile={props.onShowProfile}
        style={{width: '100%'}}
      />
    </Box>

    <Box style={{...globalStyles.flexBoxRow}}>
      <Divider style={{marginBottom: 20, marginTop: 20}} />
    </Box>

    <Box style={{...globalStyles.flexBoxRow, alignSelf: 'center'}}>
      <Checkbox
        checked={props.muted}
        onCheck={checked => props.onMuteConversation(checked)}
        label="Mute notifications"
      />
      <Icon
        type="iconfont-shh"
        style={{marginLeft: globalMargins.tiny, fontSize: 24, color: globalColors.black_20}}
      />
    </Box>

    <Box style={{...globalStyles.flexBoxRow}}>
      <Divider style={{marginBottom: 20, marginTop: 20}} />
    </Box>

    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
      <Button type="Danger" label="Block this conversation" onClick={props.onShowBlockConversationDialog} />
    </Box>

    <Box style={{...globalStyles.flexBoxRow}}>
      <Divider style={{marginBottom: 20, marginTop: 20}} />
    </Box>
  </NativeScrollView>
)

const Contents = HeaderHoc(_Contents)

const SidePanel = (props: Props) => (
  <PopupDialog
    onClose={props.onToggleSidePanel}
    styleCover={{paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0}}
    styleContainer={{borderRadius: 0}}
  >
    <Contents
      {...props}
      onBack={props.onToggleSidePanel}
      headerStyle={{borderBottomWidth: 0, marginTop: 0}}
    />
  </PopupDialog>
)

export default SidePanel
