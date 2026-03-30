import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import Notifications from './render'
import useNotifications from './hooks'
import useNotificationSettings from './use-notification-settings'
import {Reloadable} from '@/common-adapters'
import {loadSettings} from '../load-settings'
import {usePushState} from '@/stores/push'

const MobileNotifications = () => {
  const notificationSettings = useNotificationSettings()
  const props = useNotifications(notificationSettings)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onReload = () => {
    loadSettings()
    notificationSettings.refresh()
  }
  return (
    <Reloadable
      onBack={navigateUp}
      waitingKeys={[C.refreshNotificationsWaitingKey, C.waitingKeySettingsLoadSettings]}
      onReload={onReload}
      reloadOnMount={true}
    >
      <Kb.ScrollView style={{...Kb.Styles.globalStyles.flexBoxColumn, flex: 1}}>
        <TurnOnNotifications />
        <Notifications {...props} />
      </Kb.ScrollView>
    </Reloadable>
  )
}

const TurnOnNotifications = () => {
  const mobileHasPermissions = usePushState(s => s.hasPermissions)
  const requestPermissions = usePushState(s => s.dispatch.requestPermissions)
  if (mobileHasPermissions) return null
  const onEnable = requestPermissions
  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      relative={true}
      overflow="hidden"
      style={{
        backgroundColor: Kb.Styles.globalColors.red,
        height: 330,
      }}
    >
      <Kb.Box2
        direction="vertical"
        style={{
          height: 270,
          left: Kb.Styles.globalMargins.medium,
          position: 'absolute',
          top: -20,
          width: 250,
        }}
      >
        <Kb.ImageIcon type="illustration-turn-on-notifications" />
      </Kb.Box2>
      <Kb.Text
        type="BodySemibold"
        center={true}
        negative={true}
        style={{
          bottom: Kb.Styles.globalMargins.medium,
          left: Kb.Styles.globalMargins.small,
          position: 'absolute',
          right: Kb.Styles.globalMargins.small,
        }}
      >
        You turned off native notifications for Keybase. It’s{' '}
        <Kb.Text type="BodySemiboldItalic" negative={true}>
          very
        </Kb.Text>{' '}
        important you turn them back on.
        {'\n'}
        <Kb.Text onClick={onEnable} type="BodySemiboldLink" negative={true}>
          Enable notifications
        </Kb.Text>
      </Kb.Text>
    </Kb.Box2>
  )
}

export default MobileNotifications
