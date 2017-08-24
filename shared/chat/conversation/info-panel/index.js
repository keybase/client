// @flow
import * as React from 'react'
import {Box, Button, Checkbox, Divider, HeaderHoc, Icon, ScrollView} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../styles'
import {isMobile} from '../../../constants/platform'
import {branch} from 'recompose'

import Participants from './participants'

import type {Props} from '.'

const border = `1px solid ${globalColors.black_05}`
const containerStyle = isMobile
  ? {
      flex: 1,
      width: '100%',
    }
  : {
      backgroundColor: globalColors.white,
      borderLeft: border,
      borderRight: border,
      flex: 1,
      marginTop: -1,
      overflowY: 'auto',
    }

const _InfoPanel = (props: Props) => (
  <ScrollView style={containerStyle}>
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
  </ScrollView>
)

const InfoPanel = branch(() => isMobile, HeaderHoc)(_InfoPanel)

export default InfoPanel
