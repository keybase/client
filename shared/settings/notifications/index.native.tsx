import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import Notifications from './render'
import {Reloadable} from '@/common-adapters'
import {useSettingsNotifState} from '@/stores/settings-notifications'
import {useSettingsState} from '@/stores/settings'
import {usePushState} from '@/stores/push'

const MobileNotifications = () => {
  const loadSettings = useSettingsState(s => s.dispatch.loadSettings)
  const refresh = useSettingsNotifState(s => s.dispatch.refresh)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onReload = () => {
    loadSettings()
    refresh()
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
        <Notifications />
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
    <Kb.Box
      style={{
        ...Kb.Styles.globalStyles.flexBoxColumn,
        backgroundColor: Kb.Styles.globalColors.red,
        height: 330,
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
      }}
    >
      <Kb.Box
        style={{
          height: 270,
          left: Kb.Styles.globalMargins.medium,
          position: 'absolute',
          top: -20,
          width: 250,
        }}
      >
        <Kb.Icon type="illustration-turn-on-notifications" />
      </Kb.Box>
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
    </Kb.Box>
  )
}

export default MobileNotifications
