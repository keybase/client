import * as C from '@/constants'
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
import {openAppSettings} from '@/util/storeless-actions'
import {setThreadInputCommandStatus} from '@/constants/router'
import {sendTextToConversation} from '../send-actions'
import {useConversationMeta} from '../data-hooks'

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
  onPermissionDenied: (displayText: string) => void,
  setLocation: React.Dispatch<React.SetStateAction<T.Chat.Coordinate | undefined>>
) => {
  React.useEffect(() => {
    let unsub = () => {}
    logger.info('[location] perms check due to map')
    const f = async () => {
      try {
        await (requestLocationPermission as (mode?: T.RPCChat.UIWatchPositionPerm) => Promise<void>)(
          T.RPCChat.UIWatchPositionPerm.base
        )
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
        const errorMessage = String(error.message)
        logger.info('failed to get location: ' + errorMessage)
        onPermissionDenied(`Failed to access location. ${errorMessage}`)
      }
    }

    C.ignorePromise(f())
    return () => {
      unsub()
    }
  }, [conversationIDKey, onPermissionDenied, setLocation])
}

const LocationPopupInner = (props: {conversationIDKey: T.Chat.ConversationIDKey}) => {
  const {conversationIDKey} = props
  const {tlfname} = useConversationMeta(conversationIDKey)
  const username = useCurrentUserState(s => s.username)
  const httpSrv = useConfigState(s => s.httpSrv)
  const [location, setLocation] = React.useState<T.Chat.Coordinate>()
  const [locationDenied, setLocationDenied] = React.useState(false)
  const onPermissionDenied = React.useCallback(
    (displayText: string) => {
      setLocationDenied(true)
      setThreadInputCommandStatus(conversationIDKey, {
        actions: [T.RPCChat.UICommandStatusActionTyp.appsettings],
        displayText,
        displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
      })
    },
    [conversationIDKey]
  )
  const [mapLoaded, setMapLoaded] = React.useState(false)
  const clearModals = C.Router2.clearModals
  const onClose = () => {
    clearModals()
  }
  const onLocationShare = (duration: string) => {
    onClose()
    if (!tlfname) {
      logger.warn('LocationPopup: no tlfname for send')
      return
    }
    sendTextToConversation(conversationIDKey, tlfname, duration ? `/location live ${duration}` : '/location')
  }

  useWatchPosition(conversationIDKey, onPermissionDenied, setLocation)

  const width = Math.ceil(Kb.Styles.dimensionWidth)
  const height = Math.ceil(Kb.Styles.dimensionHeight - 320)
  const mapSrc = location
    ? `http://${httpSrv.address}/map?lat=${location.lat}&lon=${location.lon}&width=${width}&height=${height}&username=${username}&token=${httpSrv.token}`
    : ''
  return (
    <>
      {locationDenied ? (
        <Kb.Box2 direction="vertical" padding="small" style={styles.denied} gap="small" justifyContent="center">
          <Kb.Text center={true} type="Body" style={styles.deniedText}>
            Location permission denied.
          </Kb.Text>
          <Kb.Text center={true} type="Body" style={styles.deniedText}>
            Enable location for Keybase to see your current position.
          </Kb.Text>
          <Kb.Button label="Open settings" onClick={openAppSettings} />
        </Kb.Box2>
      ) : (
        <LocationMap mapSrc={mapSrc} height={height} width={width} onLoad={() => setMapLoaded(true)} />
      )}
      <Kb.ModalFooter>
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
      </Kb.ModalFooter>
    </>
  )
}

type LocationPopupProps = {conversationIDKey?: T.Chat.ConversationIDKey}

const LocationPopupMobile = (props: LocationPopupProps) => {
  const conversationIDKey = props.conversationIDKey ?? T.Chat.noConversationIDKey
  return <LocationPopupInner conversationIDKey={conversationIDKey} />
}
const LocationPopup = isMobile ? LocationPopupMobile : () => null

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      accuracy: {
        color: Kb.Styles.globalColors.black_50,
      },
      denied: {
        ...Kb.Styles.globalStyles.fillAbsolute,
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
    }) as const
)

export default LocationPopup
