// @flow
import * as React from 'react'
import {Box, Checkbox, Icon, RadioButton, Text} from '../../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../../styles'

import type {Props} from '.'

const Notifications = ({
  channelWide,
  desktop,
  mobile,
  onSetDesktop,
  onSetMobile,
  onToggleChannelWide,
}: Props) => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      paddingLeft: globalMargins.small,
      paddingRight: globalMargins.small,
    }}
  >
    <Checkbox
      checked={channelWide}
      label="Receive notifications for @channel messages"
      onCheck={onToggleChannelWide}
    />

    <Box style={styleHeader}>
      <Text type="BodySmallSemibold">Desktop notifications</Text>
      <Icon
        style={{paddingLeft: globalMargins.xtiny, color: globalColors.black_20}}
        type="iconfont-notifications-desktop"
      />
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
      <Text type="BodySmallSemibold">Mobile notifications</Text>
      <Icon
        style={{paddingLeft: globalMargins.xtiny, color: globalColors.black_20}}
        type="iconfont-notifications-mobile"
      />
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
  paddingTop: globalMargins.small,
}

const styleRadioButton = {
  ...globalStyles.flexBoxRow,
  marginLeft: globalMargins.tiny,
}

export default Notifications
