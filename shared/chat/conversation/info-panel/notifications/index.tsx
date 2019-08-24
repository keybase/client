import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import SaveIndicator from '../../../../common-adapters/save-indicator'

export type SaveStateType = 'same' | 'saving' | 'justSaved'
export type Props = {
  channelWide: boolean
  desktop: Types.NotificationsType
  mobile: Types.NotificationsType
  muted: boolean
  saving: boolean
  toggleMuted: () => void
  updateDesktop: (arg0: Types.NotificationsType) => void
  updateMobile: (arg0: Types.NotificationsType) => void
  toggleChannelWide: () => void
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
        <Kb.Checkbox
          checked={!props.channelWide}
          label=""
          labelComponent={
            <Kb.Text type="Body">
              Ignore <Kb.Text type="BodySemibold">@here</Kb.Text> and{' '}
              <Kb.Text type="BodySemibold">@channel</Kb.Text> mentions {ignoreMentionsSuffix}
            </Kb.Text>
          }
          onCheck={props.toggleChannelWide}
        />
      )}

      <Kb.Box style={Styles.isMobile ? styleHeaderMobile : styleHeader}>
        <Kb.Text type="BodySmallSemibold">Desktop notifications</Kb.Text>
      </Kb.Box>

      <Kb.Box style={styleRadioButton}>
        <Kb.RadioButton
          style={{marginTop: Styles.globalMargins.xtiny}}
          onSelect={() => props.updateDesktop('onAnyActivity')}
          selected={props.desktop === 'onAnyActivity'}
          label={'On any activity'}
        />
      </Kb.Box>
      <Kb.Box style={styleRadioButton}>
        <Kb.RadioButton
          style={{marginTop: Styles.globalMargins.xtiny}}
          onSelect={() => props.updateDesktop('onWhenAtMentioned')}
          selected={props.desktop === 'onWhenAtMentioned'}
          label={'Only when @mentioned'}
        />
      </Kb.Box>
      <Kb.Box style={styleRadioButton}>
        <Kb.RadioButton
          style={{marginTop: Styles.globalMargins.xtiny}}
          onSelect={() => props.updateDesktop('never')}
          selected={props.desktop === 'never'}
          label={'Never'}
        />
      </Kb.Box>

      <Kb.Box style={styleHeader}>
        <Kb.Text type="BodySmallSemibold">Mobile notifications</Kb.Text>
      </Kb.Box>

      <Kb.Box style={styleRadioButton}>
        <Kb.RadioButton
          style={{marginTop: Styles.globalMargins.xtiny}}
          onSelect={() => props.updateMobile('onAnyActivity')}
          selected={props.mobile === 'onAnyActivity'}
          label={'On any activity'}
        />
      </Kb.Box>
      <Kb.Box style={styleRadioButton}>
        <Kb.RadioButton
          style={{marginTop: Styles.globalMargins.xtiny}}
          onSelect={() => props.updateMobile('onWhenAtMentioned')}
          selected={props.mobile === 'onWhenAtMentioned'}
          label={'Only when @mentioned'}
        />
      </Kb.Box>
      <Kb.Box style={styleRadioButton}>
        <Kb.RadioButton
          style={{marginTop: Styles.globalMargins.xtiny}}
          onSelect={() => props.updateMobile('never')}
          selected={props.mobile === 'never'}
          label={'Never'}
        />
      </Kb.Box>
    </React.Fragment>
  )
}

export const Notifications = (props: Props) => (
  <Kb.Box
    style={{
      ...Styles.globalStyles.flexBoxColumn,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    }}
  >
    <Kb.Box
      style={{
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        marginBottom: Styles.globalMargins.xtiny,
      }}
    >
      <Kb.Checkbox checked={props.muted} onCheck={props.toggleMuted} label="Mute all notifications" />
      <Kb.Icon
        type="iconfont-shh"
        style={{
          marginLeft: Styles.globalMargins.xtiny,
        }}
        color={Styles.globalColors.black_20}
      />
    </Kb.Box>
    {!props.muted && <UnmutedNotificationPrefs {...props} />}
    <SaveIndicator saving={props.saving} minSavingTimeMs={300} savedTimeoutMs={2500} />
  </Kb.Box>
)

const styleHeader = {
  ...Styles.globalStyles.flexBoxRow,
  paddingTop: Styles.globalMargins.small,
}

const styleHeaderMobile = {
  ...styleHeader,
  paddingBottom: Styles.globalMargins.tiny,
  paddingTop: Styles.globalMargins.medium,
}

const styleRadioButton = {
  ...Styles.globalStyles.flexBoxRow,
  marginLeft: Styles.globalMargins.tiny,
}
