// @flow
import * as React from 'react'
import {Box, Checkbox, Icon, RadioButton, Text} from '../../../../common-adapters'
import {globalMargins, globalStyles} from '../../../../styles'

import type {Props} from '.'

const Notifications = ({
  channelWide,
  desktop,
  mobile,
  onSetDesktop,
  onSetMobile,
  onToggleChannelWide,
}: Props) => (
  <Box style={globalStyles.flexBoxColumn}>
    <Box style={styleHeader}>
      <Checkbox
        checked={channelWide}
        label="Receive notifications for @channel messages"
        onCheck={onToggleChannelWide}
      />
    </Box>

    <Box style={styleHeader}>
      <Icon style={{paddingRight: globalMargins.xtiny}} type="iconfont-notifications-desktop" />
      <Text type="BodySmallSemibold">Desktop notifications</Text>
    </Box>

    <Box style={styleRadioButton}>
      <RadioButton
        style={{marginTop: globalMargins.xtiny}}
        onSelect={() => onSetDesktop('generic')}
        selected={desktop === 'generic'}
        label={'On any activity'}
      />
    </Box>
    <Box style={styleRadioButton}>
      <RadioButton
        style={{marginTop: globalMargins.xtiny}}
        onSelect={() => onSetDesktop('atmention')}
        selected={desktop === 'atmention'}
        label={'When @mentioned'}
      />
    </Box>
    <Box style={styleRadioButton}>
      <RadioButton
        style={{marginTop: globalMargins.xtiny}}
        onSelect={() => onSetDesktop('never')}
        selected={desktop === 'never'}
        label={'Never'}
      />
    </Box>

    <Box style={styleHeader}>
      <Icon style={{paddingRight: globalMargins.xtiny}} type="iconfont-notifications-mobile" />
      <Text type="BodySmallSemibold">Mobile notifications</Text>
    </Box>

    <Box style={styleRadioButton}>
      <RadioButton
        style={{marginTop: globalMargins.xtiny}}
        onSelect={() => onSetMobile('generic')}
        selected={mobile === 'generic'}
        label={'On any activity'}
      />
    </Box>
    <Box style={styleRadioButton}>
      <RadioButton
        style={{marginTop: globalMargins.xtiny}}
        onSelect={() => onSetMobile('atmention')}
        selected={mobile === 'atmention'}
        label={'When @mentioned'}
      />
    </Box>
    <Box style={styleRadioButton}>
      <RadioButton
        style={{marginTop: globalMargins.xtiny}}
        onSelect={() => onSetMobile('never')}
        selected={mobile === 'never'}
        label={'Never'}
      />
    </Box>
  </Box>
)

const styleHeader = {
  ...globalStyles.flexBoxRow,
  marginLeft: globalMargins.small,
  paddingBottom: globalMargins.tiny,
  paddingTop: globalMargins.small,
}

const styleRadioButton = {
  ...globalStyles.flexBoxRow,
  marginLeft: globalMargins.large,
}

export default Notifications
