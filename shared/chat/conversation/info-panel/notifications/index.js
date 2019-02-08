// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {Box, Checkbox, Icon, RadioButton, Text} from '../../../../common-adapters'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../../../styles'
import SaveIndicator from '../../../../common-adapters/save-indicator'

export type SaveStateType = 'same' | 'saving' | 'justSaved'
export type Props = {
  channelWide: boolean,
  desktop: Types.NotificationsType,
  mobile: Types.NotificationsType,
  muted: boolean,
  saving: boolean,
  toggleMuted: () => void,
  updateDesktop: Types.NotificationsType => void,
  updateMobile: Types.NotificationsType => void,
  toggleChannelWide: () => void,
}

const UnmutedNotificationPrefs = (props: Props) => {
  const allNotifsEnabled = props.desktop === 'onAnyActivity' && props.mobile === 'onAnyActivity'
  let ignoreMentionsSuffix = ''
  if (props.desktop === 'onAnyActivity' && props.mobile !== 'onAnyActivity') {
    ignoreMentionsSuffix = '(mobile)'
  } else if (props.mobile === 'onAnyActivity' && props.desktop !== 'onAnyActivity') {
    ignoreMentionsSuffix = '(desktop)'
  }
  return (
    <React.Fragment>
      {!allNotifsEnabled && (
        <Checkbox
          checked={!props.channelWide}
          label=""
          labelComponent={
            <Text type="Body">
              Ignore <Text type="BodySemibold">@here</Text> and <Text type="BodySemibold">@channel</Text>{' '}
              mentions {ignoreMentionsSuffix}
            </Text>
          }
          onCheck={props.toggleChannelWide}
        />
      )}

      <Box style={isMobile ? styleHeaderMobile : styleHeader}>
        <Text type="BodySmallSemibold">Desktop notifications</Text>
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
          marginLeft: globalMargins.xtiny,
        }}
        fontSize={isMobile ? 24 : undefined}
        color={globalColors.black_20}
      />
    </Box>
    {!props.muted && <UnmutedNotificationPrefs {...props} />}
    <SaveIndicator saving={props.saving} minSavingTimeMs={300} savedTimeoutMs={2500} />
  </Box>
)

const styleHeader = {
  ...globalStyles.flexBoxRow,
  paddingTop: globalMargins.small,
}

const styleHeaderMobile = {
  ...styleHeader,
  paddingBottom: globalMargins.tiny,
  paddingTop: globalMargins.medium,
}

const styleRadioButton = {
  ...globalStyles.flexBoxRow,
  marginLeft: globalMargins.tiny,
}
