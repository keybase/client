import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import LocationMap from '@/chat/location-map'
import {watchPositionForMap} from '@/constants/platform-specific'

const LocationPopup = () => {
  const conversationIDKey = C.useChatContext(s => s.id)
  const username = C.useCurrentUserState(s => s.username)
  const httpSrv = C.useConfigState(s => s.httpSrv)
  const location = C.useChatState(s => s.lastCoord)
  const locationDenied = C.useChatContext(
    s => s.commandStatus?.displayType === T.RPCChat.UICommandStatusDisplayTyp.error
  )
  const [mapLoaded, setMapLoaded] = React.useState(false)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onClose = () => {
    clearModals()
  }
  const onSettings = C.useConfigState(s => s.dispatch.dynamic.openAppSettings)
  const messageSend = C.useChatContext(s => s.dispatch.messageSend)
  const onLocationShare = (duration: string) => {
    onClose()
    messageSend(duration ? `/location live ${duration}` : '/location')
  }

  React.useEffect(() => {
    let unwatch: undefined | (() => void)
    watchPositionForMap(conversationIDKey)
      .then(unsub => {
        unwatch = unsub
      })
      .catch(() => {})
    return () => {
      unwatch?.()
    }
  }, [conversationIDKey])

  const width = Math.ceil(Kb.Styles.dimensionWidth)
  const height = Math.ceil(Kb.Styles.dimensionHeight - 320)
  const mapSrc = location
    ? `http://${httpSrv.address}/map?lat=${location.lat}&lon=${location.lon}&width=${width}&height=${height}&username=${username}&token=${httpSrv.token}`
    : ''
  return (
    <Kb.Modal
      header={{
        leftButton: (
          <Kb.Text type="BodyBigLink" onClick={onClose}>
            Cancel
          </Kb.Text>
        ),
        title: 'Location',
      }}
      footer={{
        content: (
          <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true}>
            <Kb.Button
              disabled={locationDenied}
              fullWidth={true}
              label="Share location for 15 minutes"
              onClick={() => onLocationShare('15m')}
              mode="Secondary"
              type="Default"
              style={styles.liveButton}
              subLabel="Live location"
            />
            <Kb.Button
              disabled={locationDenied}
              fullWidth={true}
              label="Share location for 1 hour"
              onClick={() => onLocationShare('1h')}
              mode="Secondary"
              type="Default"
              style={styles.liveButton}
              subLabel="Live location"
            />
            <Kb.Button
              disabled={locationDenied}
              fullWidth={true}
              onClick={() => onLocationShare('8h')}
              label="Share location for 8 hours"
              mode="Secondary"
              type="Default"
              style={styles.liveButton}
              subLabel="Live location"
            />
            <Kb.Button
              disabled={locationDenied}
              fullWidth={true}
              label="Send current location"
              onClick={() => onLocationShare('')}
              type="Default"
              style={{height: 53}}
              subLabel={mapLoaded ? `Accurate to ${location ? location.accuracy : 0} meters` : undefined}
              subLabelStyle={styles.accuracy}
            />
          </Kb.Box2>
        ),
      }}
    >
      {locationDenied ? (
        <Kb.Box2 direction="vertical" style={styles.denied} gap="small">
          <Kb.Text center={true} type="Body" style={styles.deniedText}>
            Location permission denied.
          </Kb.Text>
          <Kb.Text center={true} type="Body" style={styles.deniedText}>
            Enable location for Keybase to see your current position.
          </Kb.Text>
          <Kb.Button label="Open settings" onClick={onSettings} />
        </Kb.Box2>
      ) : (
        <LocationMap mapSrc={mapSrc} height={height} width={width} onLoad={() => setMapLoaded(true)} />
      )}
    </Kb.Modal>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      accuracy: {
        color: Kb.Styles.globalColors.white_75,
      },
      denied: {
        ...Kb.Styles.globalStyles.fillAbsolute,
        justifyContent: 'center',
        padding: Kb.Styles.globalMargins.small,
      },
      deniedText: {
        color: Kb.Styles.globalColors.redDark,
      },
      liveButton: {
        height: 53,
      },
    }) as const
)

export default LocationPopup
