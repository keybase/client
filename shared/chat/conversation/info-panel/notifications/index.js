// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {Box, Checkbox, Icon, RadioButton, Text} from '../../../../common-adapters'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../../../styles'
import {type SaveState, default as SaveIndicator} from '../../../../common-adapters/save-indicator'

export type SaveStateType = 'same' | 'saving' | 'justSaved'
export type Props = {
  channelWide: boolean,
  desktop: Types.NotificationsType,
  mobile: Types.NotificationsType,
  muted: boolean,
  saveState: SaveState,
  toggleMuted: () => void,
  updateDesktop: Types.NotificationsType => void,
  updateMobile: Types.NotificationsType => void,
  toggleChannelWide: () => void,
}

const UnmutedNotificationPrefs = (props: Props) => (
  <React.Fragment>
    <Checkbox
      checked={!props.channelWide}
      label=""
      labelComponent={
        <Text type="Body">
          Ignore <Text type="BodySemibold">@here</Text> and <Text type="BodySemibold">@channel</Text> mentions
        </Text>
      }
      onCheck={props.toggleChannelWide}
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
        onSelect={() => props.updateDesktop('onAnyActivity')}
        selected={props.desktop === 'onAnyActivity'}
        label={'On any activity'}
      />
    </Box>
    <Box style={styleRadioButton}>
      <RadioButton
        style={{marginTop: globalMargins.xtiny}}
        onSelect={() => props.updateDesktop('onWhenAtMentioned')}
        selected={props.desktop === 'onWhenAtMentioned'}
        label={'Only when @mentioned'}
      />
    </Box>
    <Box style={styleRadioButton}>
      <RadioButton
        style={{marginTop: globalMargins.xtiny}}
        onSelect={() => props.updateDesktop('never')}
        selected={props.desktop === 'never'}
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
        onSelect={() => props.updateMobile('onAnyActivity')}
        selected={props.mobile === 'onAnyActivity'}
        label={'On any activity'}
      />
    </Box>
    <Box style={styleRadioButton}>
      <RadioButton
        style={{marginTop: globalMargins.xtiny}}
        onSelect={() => props.updateMobile('onWhenAtMentioned')}
        selected={props.mobile === 'onWhenAtMentioned'}
        label={'Only when @mentioned'}
      />
    </Box>
    <Box style={styleRadioButton}>
      <RadioButton
        style={{marginTop: globalMargins.xtiny}}
        onSelect={() => props.updateMobile('never')}
        selected={props.mobile === 'never'}
        label={'Never'}
      />
    </Box>
  </React.Fragment>
)

export const Notifications = (props: Props) => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      paddingLeft: globalMargins.small,
      paddingRight: globalMargins.small,
    }}
  >
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        marginBottom: globalMargins.xtiny,
      }}
    >
      <Checkbox checked={props.muted} onCheck={props.toggleMuted} label="Mute all notifications" />
      <Icon
        type="iconfont-shh"
        style={{
          color: globalColors.black_20,
          marginLeft: globalMargins.xtiny,
          ...(isMobile ? {fontSize: 24} : {}),
        }}
      />
    </Box>
    {!props.muted && <UnmutedNotificationPrefs {...props} />}
    <Box style={styleSaveState}>
      <SaveIndicator saveState={props.saveState} />
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

const styleSaveState = {
  ...globalStyles.flexBoxRow,
  height: globalMargins.medium,
  justifyContent: 'center',
  alignItems: 'center',
}
