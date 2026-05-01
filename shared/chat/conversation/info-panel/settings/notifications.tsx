import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {ignorePromise} from '@/constants/utils'
import {muteConversationPromise} from '../../status-actions'
import {useConversationMeta} from '../../data-hooks'

export type SaveStateType = 'same' | 'saving' | 'justSaved'

type UnmutedProps = {
  channelWide: boolean
  desktop: T.Chat.NotificationsType
  mobile: T.Chat.NotificationsType
  setDesktop: (n: T.Chat.NotificationsType) => void
  setMobile: (n: T.Chat.NotificationsType) => void
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
            <Kb.Box2 direction="vertical" flex={1}>
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
            style={{marginTop: Kb.Styles.globalMargins.xtiny}}
            onSelect={() => setDesktop('onAnyActivity')}
            selected={desktop === 'onAnyActivity'}
            label="On any activity"
          />
        </Kb.Box2>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.radioButton}>
          <Kb.RadioButton
            style={{marginTop: Kb.Styles.globalMargins.xtiny}}
            onSelect={() => setDesktop('onWhenAtMentioned')}
            selected={desktop === 'onWhenAtMentioned'}
            label="Only when @mentioned"
          />
        </Kb.Box2>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.radioButton}>
          <Kb.RadioButton
            style={{marginTop: Kb.Styles.globalMargins.xtiny}}
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
            style={{marginTop: Kb.Styles.globalMargins.xtiny}}
            onSelect={() => setMobile('onAnyActivity')}
            selected={mobile === 'onAnyActivity'}
            label="On any activity"
          />
        </Kb.Box2>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.radioButton}>
          <Kb.RadioButton
            style={{marginTop: Kb.Styles.globalMargins.xtiny}}
            onSelect={() => setMobile('onWhenAtMentioned')}
            selected={mobile === 'onWhenAtMentioned'}
            label="Only when @mentioned"
          />
        </Kb.Box2>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.radioButton}>
          <Kb.RadioButton
            style={{marginTop: Kb.Styles.globalMargins.xtiny}}
            onSelect={() => setMobile('never')}
            selected={mobile === 'never'}
            label="Never"
          />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const Notifications = (props: {conversationIDKey: T.Chat.ConversationIDKey}) => {
  const {conversationIDKey} = props
  const meta = useConversationMeta(conversationIDKey)
  const [channelWide, setChannelWide] = React.useState(meta.notificationsGlobalIgnoreMentions)
  const [desktop, setDesktop] = React.useState(meta.notificationsDesktop)
  const [mobile, setMobile] = React.useState(meta.notificationsMobile)
  const [muted, setMuted] = React.useState(meta.isMuted)
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState('')
  const latestSaveIDRef = React.useRef(0)
  const startSave = () => {
    const saveID = latestSaveIDRef.current + 1
    latestSaveIDRef.current = saveID
    setSaveError('')
    setSaving(true)
    return saveID
  }
  const finishSave = (saveID: number) => {
    if (latestSaveIDRef.current === saveID) {
      setSaving(false)
    }
  }
  const failSave = (saveID: number, error: unknown) => {
    if (latestSaveIDRef.current !== saveID) {
      return
    }
    setSaveError(
      error instanceof Error && error.message ? error.message : 'Failed to save notification settings.'
    )
    setSaving(false)
  }
  const saveNotifications = (
    desktop: T.Chat.NotificationsType,
    mobile: T.Chat.NotificationsType,
    channelWide: boolean
  ) => {
    const saveID = startSave()
    const f = async () => {
      try {
        await T.RPCChat.localSetAppNotificationSettingsLocalRpcPromise({
          channelWide,
          convID: T.Chat.keyToConversationID(conversationIDKey),
          settings: [
            {
              deviceType: T.RPCGen.DeviceType.desktop,
              enabled: desktop === 'onWhenAtMentioned',
              kind: T.RPCChat.NotificationKind.atmention,
            },
            {
              deviceType: T.RPCGen.DeviceType.desktop,
              enabled: desktop === 'onAnyActivity',
              kind: T.RPCChat.NotificationKind.generic,
            },
            {
              deviceType: T.RPCGen.DeviceType.mobile,
              enabled: mobile === 'onWhenAtMentioned',
              kind: T.RPCChat.NotificationKind.atmention,
            },
            {
              deviceType: T.RPCGen.DeviceType.mobile,
              enabled: mobile === 'onAnyActivity',
              kind: T.RPCChat.NotificationKind.generic,
            },
          ],
        })
        finishSave(saveID)
      } catch (error) {
        failSave(saveID, error)
      }
    }
    ignorePromise(f())
  }
  const saveMuted = (muted: boolean) => {
    const saveID = startSave()
    const f = async () => {
      try {
        await muteConversationPromise(conversationIDKey, muted)
        finishSave(saveID)
      } catch (error) {
        failSave(saveID, error)
      }
    }
    ignorePromise(f())
  }

  const [lastMeta, setLastMeta] = React.useState<undefined | T.Chat.ConversationMeta>()
  if (lastMeta !== meta) {
    setLastMeta(meta)
    setDesktop(meta.notificationsDesktop)
    setMobile(meta.notificationsMobile)
    setMuted(meta.isMuted)
    setChannelWide(meta.notificationsGlobalIgnoreMentions)
  }

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
        <Kb.Icon type="iconfont-shh" style={styles.icon} color={Kb.Styles.globalColors.black_20} />
      </Kb.Box2>
      {!muted && (
        <UnmutedNotificationPrefs
          channelWide={channelWide}
          setDesktop={(n: T.Chat.NotificationsType) => {
            setDesktop(n)
            saveNotifications(n, mobile, channelWide)
          }}
          desktop={desktop}
          setMobile={(n: T.Chat.NotificationsType) => {
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
      {saveError ? (
        <Kb.Banner color="red">
          <Kb.BannerParagraph bannerColor="red" content={saveError} />
        </Kb.Banner>
      ) : (
        <Kb.SaveIndicator saving={saving} />
      )}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      icon: {marginLeft: Kb.Styles.globalMargins.xtiny},
      radioButton: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        marginLeft: Kb.Styles.globalMargins.tiny,
      },
    }) as const
)

export default Notifications
