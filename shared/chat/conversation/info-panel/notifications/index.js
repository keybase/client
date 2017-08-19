// @flow
import * as React from 'react'
import {Box, RadioButton, Text} from '../../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../../styles'

import type {Props} from '.'

const Notifications = ({desktop, mobile, onSetDesktop, onSetMobile}: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, paddingTop: globalMargins.tiny}}>
    <Box style={{...globalStyles.flexBoxRow, paddingBottom: globalMargins.tiny}}>
      <Text type="BodySmallSemibold">Desktop notifications</Text>
    </Box>
    <Box style={globalStyles.flexBoxRow}>
      <RadioButton
        style={{marginTop: globalMargins.xtiny}}
        onSelect={() => onSetDesktop('generic')}
        selected={desktop === 'generic'}
        label={'On any activity'}
      />
    </Box>
    <Box style={globalStyles.flexBoxRow}>
      <RadioButton
        style={{marginTop: globalMargins.xtiny}}
        onSelect={() => onSetDesktop('atmention')}
        selected={desktop === 'atmention'}
        label={'When @mentioned'}
      />
    </Box>
    <Box style={globalStyles.flexBoxRow}>
      <RadioButton
        style={{marginTop: globalMargins.xtiny}}
        onSelect={() => onSetDesktop('never')}
        selected={desktop === 'never'}
        label={'Never'}
      />
    </Box>
    <Box style={{...globalStyles.flexBoxRow, paddingTop: globalMargins.small, padddingBottom: globalMargins.tiny}}>
      <Text type="BodySmallSemibold">Mobile notifications</Text>
    </Box>
    <Box style={globalStyles.flexBoxRow}>
      <RadioButton
        style={{marginTop: globalMargins.small}}
        onSelect={() => onSetMobile('generic')}
        selected={desktop === 'generic'}
        label={'On any activity'}
      />
      <RadioButton
        style={{marginTop: globalMargins.small}}
        onSelect={() => onSetMobile('atmention')}
        selected={desktop === 'atmention'}
        label={'When @mentioned'}
      />
      <RadioButton
        style={{marginTop: globalMargins.small}}
        onSelect={() => onSetMobile('never')}
        selected={mobile === 'never'}
        label={'Never'}
      />
    </Box>
  </Box>
)

export default Notifications
