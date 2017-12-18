// @flow
import * as React from 'react'
import {Box, Checkbox, Icon, RadioButton, Text} from '../../../../common-adapters'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../../../styles'
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
      checked={!channelWide}
      label="Ignore @here and @channel mentions"
      onCheck={onToggleChannelWide}
    />

    <Box style={isMobile ? styleHeaderMobile : styleHeader}>
      <Text type="BodySmallSemibold">Desktop notifications</Text>
      <Icon
        style={{fontSize: isMobile ? 20 : 16, paddingLeft: globalMargins.xtiny, color: globalColors.black_20}}
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
        label={'Only when @mentioned'}
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
        style={{fontSize: isMobile ? 20 : 16, paddingLeft: globalMargins.xtiny, color: globalColors.black_20}}
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
        label={'Only when @mentioned'}
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

const styleHeaderMobile = {
  ...styleHeader,
  paddingTop: globalMargins.medium,
  paddingBottom: globalMargins.tiny,
}

const styleRadioButton = {
  ...globalStyles.flexBoxRow,
  marginLeft: globalMargins.tiny,
}

export default Notifications
