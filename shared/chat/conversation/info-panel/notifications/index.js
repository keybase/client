// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {Box, Checkbox, Icon, RadioButton, ProgressIndicator, Text} from '../../../../common-adapters'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../../../styles'

export type SaveStateType = 'same' | 'saving' | 'justSaved'
export type Props = {
  channelWide: boolean,
  desktop: Types.NotificationsType,
  mobile: Types.NotificationsType,
  muted: boolean,
  saveState: SaveStateType,
  toggleMuted: () => void,
  updateDesktop: Types.NotificationsType => void,
  updateMobile: Types.NotificationsType => void,
  toggleChannelWide: () => void,
}

const SaveStateComponent = ({saveState}) => {
  switch (saveState) {
    case 'same':
      return null
    case 'saving':
      return <ProgressIndicator style={{alignSelf: 'center', width: globalMargins.medium}} />
    case 'justSaved':
      return [
        <Icon key="0" type="iconfont-check" style={{color: globalColors.green}} />,
        <Text key="1" type="BodySmall" style={{color: globalColors.green2}}>
          &nbsp; Saved
        </Text>,
      ]
  }
}

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

    <Checkbox
      checked={!props.channelWide}
      label="Ignore @here and @channel mentions"
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
    <Box style={styleSaveState}>
      <SaveStateComponent saveState={props.saveState} />
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
  height: globalMargins.large,
  justifyContent: 'center',
  paddingTop: globalMargins.small,
}
