import * as React from 'react'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Types from '../../../../constants/types/chat2'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'

export type SaveStateType = 'same' | 'saving' | 'justSaved'
export type Props = {
  conversationIDKey: Types.ConversationIDKey
}

type UnmutedProps = {
  channelWide: boolean
  desktop: Types.NotificationsType
  mobile: Types.NotificationsType
  setDesktop: (n: Types.NotificationsType) => void
  setMobile: (n: Types.NotificationsType) => void
  toggleChannelWide: () => void
}

const UnmutedNotificationPrefs = (props: UnmutedProps) => {
  const {desktop, setDesktop, mobile, setMobile, channelWide, toggleChannelWide} = props
  const allNotifsEnabled = desktop === 'onAnyActivity' && mobile === 'onAnyActivity'
  let ignoreMentionsSuffix = ''
  if (desktop === 'onAnyActivity' && mobile !== 'onAnyActivity') {
    ignoreMentionsSuffix = '(mobile)'
  } else if (mobile === 'onAnyActivity' && desktop !== 'onAnyActivity') {
    ignoreMentionsSuffix = '(desktop)'
  }
  return (
    <>
      {!allNotifsEnabled && (
        <Kb.Checkbox
          checked={!channelWide}
          label=""
          labelComponent={
            <Kb.Box2 direction="vertical" style={{flex: 1}}>
              <Kb.Text type="Body">
                Ignore <Kb.Text type="BodySemibold">@here</Kb.Text> and{' '}
                <Kb.Text type="BodySemibold">@channel</Kb.Text> mentions {ignoreMentionsSuffix}
              </Kb.Text>
            </Kb.Box2>
          }
          onCheck={toggleChannelWide}
        />
      )}

      <Kb.Box style={styles.header}>
        <Kb.Text type="BodySmallSemibold">Desktop notifications</Kb.Text>
      </Kb.Box>

      <Kb.Box style={styles.radioButton}>
        <Kb.RadioButton
          style={{marginTop: Styles.globalMargins.xtiny}}
          onSelect={() => setDesktop('onAnyActivity')}
          selected={desktop === 'onAnyActivity'}
          label="On any activity"
        />
      </Kb.Box>
      <Kb.Box style={styles.radioButton}>
        <Kb.RadioButton
          style={{marginTop: Styles.globalMargins.xtiny}}
          onSelect={() => setDesktop('onWhenAtMentioned')}
          selected={desktop === 'onWhenAtMentioned'}
          label="Only when @mentioned"
        />
      </Kb.Box>
      <Kb.Box style={styles.radioButton}>
        <Kb.RadioButton
          style={{marginTop: Styles.globalMargins.xtiny}}
          onSelect={() => setDesktop('never')}
          selected={desktop === 'never'}
          label="Never"
        />
      </Kb.Box>

      <Kb.Box style={styles.header}>
        <Kb.Text type="BodySmallSemibold">Mobile notifications</Kb.Text>
      </Kb.Box>

      <Kb.Box style={styles.radioButton}>
        <Kb.RadioButton
          style={{marginTop: Styles.globalMargins.xtiny}}
          onSelect={() => setMobile('onAnyActivity')}
          selected={mobile === 'onAnyActivity'}
          label="On any activity"
        />
      </Kb.Box>
      <Kb.Box style={styles.radioButton}>
        <Kb.RadioButton
          style={{marginTop: Styles.globalMargins.xtiny}}
          onSelect={() => setMobile('onWhenAtMentioned')}
          selected={mobile === 'onWhenAtMentioned'}
          label="Only when @mentioned"
        />
      </Kb.Box>
      <Kb.Box style={styles.radioButton}>
        <Kb.RadioButton
          style={{marginTop: Styles.globalMargins.xtiny}}
          onSelect={() => setMobile('never')}
          selected={mobile === 'never'}
          label="Never"
        />
      </Kb.Box>
    </>
  )
}

const Notifications = (props: Props) => {
  const {conversationIDKey} = props
  const dispatch = Container.useDispatch()
  const meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const [channelWide, _setChannelWide] = React.useState(meta.notificationsGlobalIgnoreMentions)
  const [desktop, setDesktop] = React.useState(meta.notificationsDesktop)
  const [mobile, setMobile] = React.useState(meta.notificationsMobile)
  const [muted, setMuted] = React.useState(meta.isMuted)
  const [saving, setSaving] = React.useState(false)
  const delayUnsave = Kb.useTimeout(() => setSaving(false), 100)

  Container.useDepChangeEffect(() => {
    setSaving(true)
    dispatch(
      Chat2Gen.createUpdateNotificationSettings({
        conversationIDKey,
        notificationsDesktop: desktop,
        notificationsGlobalIgnoreMentions: channelWide,
        notificationsMobile: mobile,
      })
    )
    delayUnsave()
  }, [dispatch, conversationIDKey, desktop, channelWide, mobile, delayUnsave])

  Container.useDepChangeEffect(() => {
    setSaving(true)
    dispatch(Chat2Gen.createMuteConversation({conversationIDKey, muted}))
    delayUnsave()
  }, [dispatch, conversationIDKey, muted, delayUnsave])

  const writeNotifications = React.useCallback(() => {}, [])

  const setChannelWide = React.useCallback(
    (c: boolean) => {
      _setChannelWide(c)
      writeNotifications()
    },
    [_setChannelWide, writeNotifications]
  )

  return (
    <Kb.Box style={styles.container}>
      <Kb.Box style={styles.top}>
        <Kb.Checkbox checked={muted} onCheck={() => setMuted(!muted)} label="Mute all notifications" />
        <Kb.Icon type="iconfont-shh" style={styles.icon} color={Styles.globalColors.black_20} />
      </Kb.Box>
      {!muted && (
        <UnmutedNotificationPrefs
          channelWide={channelWide}
          setDesktop={setDesktop}
          desktop={desktop}
          setMobile={setMobile}
          mobile={mobile}
          toggleChannelWide={() => setChannelWide(!channelWide)}
        />
      )}
      <Kb.SaveIndicator saving={saving} minSavingTimeMs={300} savedTimeoutMs={2500} />
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Styles.globalStyles.flexBoxColumn,
        paddingLeft: Styles.globalMargins.small,
        paddingRight: Styles.globalMargins.small,
      },
      header: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.flexBoxRow,
          paddingTop: Styles.globalMargins.small,
        },
        isMobile: {
          paddingBottom: Styles.globalMargins.tiny,
          paddingTop: Styles.globalMargins.medium,
        },
      }),
      icon: {marginLeft: Styles.globalMargins.xtiny},
      radioButton: {
        ...Styles.globalStyles.flexBoxRow,
        marginLeft: Styles.globalMargins.tiny,
      },
      top: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        marginBottom: Styles.globalMargins.xtiny,
      },
    } as const)
)

export default Notifications
