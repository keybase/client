import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as Container from '../../../../util/container'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import {isIOS} from '../../../../constants/platform'
import HiddenString from '../../../../util/hidden-string'

type Props = Container.RouteProps<{conversationIDKey: Types.ConversationIDKey}>

const LocationPopup = (props: Props) => {
  // state
  const conversationIDKey = Container.getRouteProps(props, 'conversationIDKey', Constants.noConversationIDKey)
  const {httpSrvAddress, httpSrvToken, location} = Container.useSelector(state => ({
    httpSrvAddress: state.config.httpSrvAddress,
    httpSrvToken: state.config.httpSrvToken,
    location: state.chat2.lastCoord,
  }))
  const [mapLoaded, setMapLoaded] = React.useState(false)
  // dispatch
  const dispatch = Container.useDispatch()
  const onClose = () => {
    dispatch(RouteTreeGen.createClearModals())
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
  // lifecycle
  React.useEffect(() => {
    const watchID = navigator.geolocation.watchPosition(
      pos => {
        dispatch(
          Chat2Gen.createUpdateLastCoord({
            coord: {
              accuracy: Math.floor(pos.coords.accuracy),
              lat: pos.coords.latitude,
              lon: pos.coords.longitude,
            },
          })
        )
      },
      () => {},
      {enableHighAccuracy: isIOS, maximumAge: 0, timeout: 30000}
    )
    return () => {
      navigator.geolocation.clearWatch(watchID)
    }
  }, [])

  // render
  const width = Styles.dimensionWidth
  const height = Styles.dimensionHeight - 320
  const mapSrc = location
    ? `http://${httpSrvAddress}/map?lat=${location.lat}&lon=${
        location.lon
      }&width=${width}&height=${height}&token=${httpSrvToken}`
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
              fullWidth={true}
              onClick={() => onLocationShare('15m')}
              label="Share location for 15 minutes"
              mode="Secondary"
              type="Default"
              style={styles.liveButton}
            />
            <Kb.Button
              fullWidth={true}
              onClick={() => onLocationShare('1h')}
              label="Share location for 1 hour"
              mode="Secondary"
              type="Default"
              style={styles.liveButton}
            />
            <Kb.Button
              fullWidth={true}
              onClick={() => onLocationShare('8h')}
              label="Share location for 8 hours"
              mode="Secondary"
              type="Default"
              style={styles.liveButton}
            />
            <Kb.Divider />
            <Kb.Button
              fullWidth={true}
              onClick={() => onLocationShare('')}
              type="Default"
              style={{height: 53}}
            >
              <Kb.Box2 direction="vertical" fullHeight={true} centerChildren={true}>
                <Kb.Text type="BodySemibold" negative={true}>
                  Share current location
                </Kb.Text>
                {mapLoaded && (
                  <Kb.Text type="BodyTiny" style={styles.accuracy}>
                    Accurate to {location ? location.accuracy : 0} meters
                  </Kb.Text>
                )}
              </Kb.Box2>
            </Kb.Button>
          </Kb.Box2>
        ),
      }}
    >
      <Kb.LocationMap mapSrc={mapSrc} height={height} width={width} onLoad={() => setMapLoaded(true)} />
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  accuracy: {
    color: Styles.globalColors.white_75,
    lineHeight: 14,
  },
  liveButton: {
    height: 53,
  },
}))

export default LocationPopup
