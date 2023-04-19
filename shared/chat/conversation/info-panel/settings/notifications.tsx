import * as React from 'react'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import type * as Types from '../../../../constants/types/chat2'
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
    <Kb.Box2 direction="vertical" fullWidth={true} gap="small">
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

      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Text type="BodySmallSemibold">Desktop notifications</Kb.Text>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.radioButton}>
          <Kb.RadioButton
            style={{marginTop: Styles.globalMargins.xtiny}}
            onSelect={() => setDesktop('onAnyActivity')}
            selected={desktop === 'onAnyActivity'}
            label="On any activity"
          />
        </Kb.Box2>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.radioButton}>
          <Kb.RadioButton
            style={{marginTop: Styles.globalMargins.xtiny}}
            onSelect={() => setDesktop('onWhenAtMentioned')}
            selected={desktop === 'onWhenAtMentioned'}
            label="Only when @mentioned"
          />
        </Kb.Box2>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.radioButton}>
          <Kb.RadioButton
            style={{marginTop: Styles.globalMargins.xtiny}}
            onSelect={() => setDesktop('never')}
            selected={desktop === 'never'}
            label="Never"
          />
        </Kb.Box2>
      </Kb.Box2>

      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Text type="BodySmallSemibold">Mobile notifications</Kb.Text>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.radioButton}>
          <Kb.RadioButton
            style={{marginTop: Styles.globalMargins.xtiny}}
            onSelect={() => setMobile('onAnyActivity')}
            selected={mobile === 'onAnyActivity'}
            label="On any activity"
          />
        </Kb.Box2>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.radioButton}>
          <Kb.RadioButton
            style={{marginTop: Styles.globalMargins.xtiny}}
            onSelect={() => setMobile('onWhenAtMentioned')}
            selected={mobile === 'onWhenAtMentioned'}
            label="Only when @mentioned"
          />
        </Kb.Box2>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.radioButton}>
          <Kb.RadioButton
            style={{marginTop: Styles.globalMargins.xtiny}}
            onSelect={() => setMobile('never')}
            selected={mobile === 'never'}
            label="Never"
          />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const Notifications = (props: Props) => {
  const {conversationIDKey} = props
  const dispatch = Container.useDispatch()
  const meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const [channelWide, setChannelWide] = React.useState(meta.notificationsGlobalIgnoreMentions)
  const [desktop, setDesktop] = React.useState(meta.notificationsDesktop)
  const [mobile, setMobile] = React.useState(meta.notificationsMobile)
  const [muted, setMuted] = React.useState(meta.isMuted)
  const [saving, setSaving] = React.useState(false)
  const delayUnsave = Kb.useTimeout(() => setSaving(false), 100)
  const saveNotifications = (
    desktop: Types.NotificationsType,
    mobile: Types.NotificationsType,
    channelWide: boolean
  ) => {
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
  }
  const saveMuted = (muted: boolean) => {
    setSaving(true)
    dispatch(Chat2Gen.createMuteConversation({conversationIDKey, muted}))
    delayUnsave()
  }

  React.useEffect(() => {
    setDesktop(meta.notificationsDesktop)
    setMobile(meta.notificationsMobile)
    setMuted(meta.isMuted)
    setChannelWide(meta.notificationsGlobalIgnoreMentions)
  }, [meta])

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="small">
      <Kb.Box2 direction="horizontal" fullWidth={true}>
        <Kb.Checkbox
          checked={muted}
          onCheck={() => {
            setMuted(!muted)
            saveMuted(!muted)
          }}
          label="Mute all notifications"
        />
        <Kb.Icon type="iconfont-shh" style={styles.icon} color={Styles.globalColors.black_20} />
      </Kb.Box2>
      {!muted && (
        <UnmutedNotificationPrefs
          channelWide={channelWide}
          setDesktop={(n: Types.NotificationsType) => {
            setDesktop(n)
            saveNotifications(n, mobile, channelWide)
          }}
          desktop={desktop}
          setMobile={(n: Types.NotificationsType) => {
            setMobile(n)
            saveNotifications(desktop, n, channelWide)
          }}
          mobile={mobile}
          toggleChannelWide={() => {
            setChannelWide(!channelWide)
            saveNotifications(desktop, mobile, !channelWide)
          }}
        />
      )}
      <Kb.SaveIndicator saving={saving} minSavingTimeMs={300} savedTimeoutMs={2500} />
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      icon: {marginLeft: Styles.globalMargins.xtiny},
      radioButton: {
        ...Styles.globalStyles.flexBoxRow,
        marginLeft: Styles.globalMargins.tiny,
      },
    } as const)
)

export default Notifications
