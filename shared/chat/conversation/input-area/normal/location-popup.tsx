import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as Container from '../../../../util/container'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as ConfigGen from '../../../../actions/config-gen'
import * as Constants from '../../../../constants/chat2'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import LocationMap from '../../../location-map'
import HiddenString from '../../../../util/hidden-string'
import {watchPositionForMap} from '../../../../actions/platform-specific'
import shallowEqual from 'shallowequal'

type Props = Container.RouteProps<'chatLocationPreview'>

const LocationPopup = (props: Props) => {
  const conversationIDKey = props.route.params?.conversationIDKey ?? Constants.noConversationIDKey
  const {httpSrvAddress, httpSrvToken, location, locationDenied, username} = Container.useSelector(state => {
    const {httpSrvAddress, httpSrvToken, username} = state.config
    const location = state.chat2.lastCoord
    const locationDenied =
      state.chat2.commandStatusMap.get(conversationIDKey)?.displayType ===
      RPCChatTypes.UICommandStatusDisplayTyp.error
    return {httpSrvAddress, httpSrvToken, location, locationDenied, username}
  }, shallowEqual)
  const [mapLoaded, setMapLoaded] = React.useState(false)
  const dispatch = Container.useDispatch()
  const onClose = () => {
    dispatch(RouteTreeGen.createClearModals())
  }
  const onSettings = () => {
    dispatch(ConfigGen.createOpenAppSettings())
  }
  const onLocationShare = (duration: string) => {
    onClose()
    dispatch(
      Chat2Gen.createMessageSend({
        conversationIDKey,
        text: duration ? new HiddenString(`/location live ${duration}`) : new HiddenString('/location'),
      })
    )
  }
  React.useEffect(() => {
    let unwatch: undefined | (() => void)
    watchPositionForMap(dispatch, conversationIDKey)
      .then(unsub => {
        unwatch = unsub
      })
      .catch(() => {})
    return () => {
      unwatch?.()
    }
  }, [dispatch, conversationIDKey])

  const width = Math.ceil(Styles.dimensionWidth)
  const height = Math.ceil(Styles.dimensionHeight - 320)
  const mapSrc = location
    ? `http://${httpSrvAddress}/map?lat=${location.lat}&lon=${location.lon}&width=${width}&height=${height}&username=${username}&token=${httpSrvToken}`
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      accuracy: {
        color: Styles.globalColors.white_75,
      },
      denied: {
        ...Styles.globalStyles.fillAbsolute,
        justifyContent: 'center',
        padding: Styles.globalMargins.small,
      },
      deniedText: {
        color: Styles.globalColors.redDark,
      },
      liveButton: {
        height: 53,
      },
    } as const)
)

export default LocationPopup
