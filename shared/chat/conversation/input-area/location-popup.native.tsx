import * as C from '@/constants'
import * as ConvoState from '@/stores/convostate'
import * as React from 'react'
import {useConfigState} from '@/stores/config'
import logger from '@/logger'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import LocationMap from '@/chat/location-map'
import {useCurrentUserState} from '@/stores/current-user'
import {requestLocationPermission} from '@/util/platform-specific'
import * as ExpoLocation from 'expo-location'
import {ignorePromise} from '@/constants/utils'

const LocationButton = (props: {
  disabled: boolean
  label: string
  onClick: () => void
  subLabel?: string
  primary?: boolean
}) => (
  <Kb.Button
    disabled={props.disabled}
    fullWidth={true}
    onClick={props.onClick}
    mode={props.primary ? 'Primary' : 'Secondary'}
    type="Default"
    style={styles.liveButton}
  >
    <Kb.Box2 direction="vertical" centerChildren={true}>
      <Kb.Text
        type="BodySemibold"
        style={props.primary ? styles.liveButtonLabelPrimary : styles.liveButtonLabel}
      >
        {props.label}
      </Kb.Text>
      {!!props.subLabel && (
        <Kb.Text type="BodyTiny" style={props.primary ? styles.liveButtonLabelPrimary : styles.accuracy}>
          {props.subLabel}
        </Kb.Text>
      )}
    </Kb.Box2>
  </Kb.Button>
)

const updateLocation = (coord: T.Chat.Coordinate) => {
  const f = async () => {
    const {accuracy, lat, lon} = coord
    await T.RPCChat.localLocationUpdateRpcPromise({coord: {accuracy, lat, lon}})
  }
  ignorePromise(f())
}

const useWatchPosition = (
  conversationIDKey: T.Chat.ConversationIDKey,
  setLocation: React.Dispatch<React.SetStateAction<T.Chat.Coordinate | undefined>>
) => {
  const setCommandStatusInfo = ConvoState.useChatUIContext(s => s.dispatch.setCommandStatusInfo)
  React.useEffect(() => {
    let unsub = () => {}
    logger.info('[location] perms check due to map')
    const f = async () => {
      try {
        await requestLocationPermission(T.RPCChat.UIWatchPositionPerm.base)
        const sub = await ExpoLocation.watchPositionAsync(
          {accuracy: ExpoLocation.LocationAccuracy.Highest},
          (location: ExpoLocation.LocationObject) => {
            const coord = {
              accuracy: Math.floor(location.coords.accuracy ?? 0),
              lat: location.coords.latitude,
              lon: location.coords.longitude,
            }
            setLocation(coord)
            updateLocation(coord)
          }
        )
        unsub = () => sub.remove()
      } catch (_error) {
        const error = _error as {message?: string}
        logger.info('failed to get location: ' + error.message)
        setCommandStatusInfo({
          actions: [T.RPCChat.UICommandStatusActionTyp.appsettings],
          displayText: `Failed to access location. ${error.message}`,
          displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
        })
      }
    }

    C.ignorePromise(f())
    return () => {
      unsub()
    }
  }, [conversationIDKey, setCommandStatusInfo, setLocation])
}

const LocationPopup = () => {
  const conversationIDKey = ConvoState.useChatContext(s => s.id)
  const username = useCurrentUserState(s => s.username)
  const httpSrv = useConfigState(s => s.httpSrv)
  const [location, setLocation] = React.useState<T.Chat.Coordinate>()
  const locationDenied = ConvoState.useChatUIContext(
    s => s.commandStatus?.displayType === T.RPCChat.UICommandStatusDisplayTyp.error
  )
  const [mapLoaded, setMapLoaded] = React.useState(false)
  const clearModals = C.Router2.clearModals
  const onClose = () => {
    clearModals()
  }
  const onSettings = useConfigState(s => s.dispatch.openAppSettings)
  const sendMessage = ConvoState.useChatContext(s => s.dispatch.sendMessage)
  const onLocationShare = (duration: string) => {
    onClose()
    sendMessage(duration ? `/location live ${duration}` : '/location')
  }

  useWatchPosition(conversationIDKey, setLocation)

  const width = Math.ceil(Kb.Styles.dimensionWidth)
  const height = Math.ceil(Kb.Styles.dimensionHeight - 320)
  const mapSrc = location
    ? `http://${httpSrv.address}/map?lat=${location.lat}&lon=${location.lon}&width=${width}&height=${height}&username=${username}&token=${httpSrv.token}`
    : ''
  return (
    <>
      {locationDenied ? (
        <Kb.Box2 direction="vertical" style={styles.denied} gap="small" justifyContent="center">
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
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.modalFooter}>
        <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true}>
          <LocationButton
            disabled={locationDenied}
            label="Share location for 15 minutes"
            onClick={() => onLocationShare('15m')}
            subLabel="Live location"
          />
          <LocationButton
            disabled={locationDenied}
            label="Share location for 1 hour"
            onClick={() => onLocationShare('1h')}
            subLabel="Live location"
          />
          <LocationButton
            disabled={locationDenied}
            label="Share location for 8 hours"
            onClick={() => onLocationShare('8h')}
            subLabel="Live location"
          />
          <LocationButton
            disabled={locationDenied}
            label="Send current location"
            onClick={() => onLocationShare('')}
            subLabel={mapLoaded ? `Accurate to ${location ? location.accuracy : 0} meters` : undefined}
            primary={true}
          />
        </Kb.Box2>
      </Kb.Box2>
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      accuracy: {
        color: Kb.Styles.globalColors.black_50,
      },
      denied: {
        ...Kb.Styles.globalStyles.fillAbsolute,
        padding: Kb.Styles.globalMargins.small,
      },
      deniedText: {
        color: Kb.Styles.globalColors.redDark,
      },
      liveButton: {
        height: 53,
      },
      liveButtonLabel: {
        color: Kb.Styles.globalColors.blueDark,
      },
      liveButtonLabelPrimary: {
        color: Kb.Styles.globalColors.whiteOrWhite,
      },
      modalFooter: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
          borderStyle: 'solid' as const,
          borderTopColor: Kb.Styles.globalColors.black_10,
          borderTopWidth: 1,
          minHeight: 56,
        },
        isElectron: {
          borderBottomLeftRadius: Kb.Styles.borderRadius,
          borderBottomRightRadius: Kb.Styles.borderRadius,
          overflow: 'hidden',
        },
      }),
    }) as const
)

export default LocationPopup
