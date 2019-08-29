import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as Container from '../../../../util/container'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import {isIOS} from '../../../../constants/platform'

type Props = {
  locationAccuracy?: number
  locationMap?: string
  onShareLocation?: (duration: number) => void
}

const LocationPopup = (props: Props) => {
  const dispatch = Container.useDispatch()
  const onClose = React.useCallback(() => {
    dispatch(RouteTreeGen.createClearModals())
  }, [dispatch])
  const [location, setLocation] = React.useState({
    accuracy: 0,
    lat: 0,
    lon: 0,
    map: '',
  })
  React.useEffect(() => {
    const watchID = navigator.geolocation.watchPosition(
      pos => {
        setLocation({
          accuracy: pos.coords.accuracy,
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          map: location.map,
        })
        RPCChatTypes.localGetLocationPreviewRpcPromise({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        }).then(result => {
          setLocation({
            ...location,
            map: result,
          })
        })
      },
      err => {},
      {enableHighAccuracy: isIOS, maximumAge: 0, timeout: 30000}
    )
    return () => {
      navigator.geolocation.clearWatch(watchID)
    }
  }, [])
  const mapSrc = `data:image/png;base64, ${location.map}`
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
              onClick={() => props.onShareLocation(0)}
              label="Share Current Location"
              type="Default"
            />
            <Kb.Divider />
            <Kb.Text type="BodySmall" center={true}>
              Live Location
            </Kb.Text>
            <Kb.Button
              fullWidth={true}
              onClick={() => props.onShareLocation(900)}
              label="Share location for 15 minutes"
              mode="Secondary"
              type="Default"
              style={styles.liveButton}
            />
            <Kb.Button
              fullWidth={true}
              onClick={() => props.onShareLocation(3600)}
              label="Share location for 1 hour"
              mode="Secondary"
              type="Default"
              style={styles.liveButton}
            />
            <Kb.Button
              fullWidth={true}
              onClick={() => props.onShareLocation(28800)}
              label="Share location for 8 hours"
              mode="Secondary"
              type="Default"
              style={styles.liveButton}
            />
          </Kb.Box2>
        ),
        hideBorder: true,
      }}
    >
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} gap="small" style={styles.container}>
        <Kb.Image src={mapSrc} style={styles.map} />
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.fillAbsolute,
    justifyContent: 'center',
  },
  image: {
    flex: 1,
    width: '150%',
  },
  liveButton: {
    minHeight: 40,
  },
  map: {
    height: 175,
    width: 320,
  },
}))

export default LocationPopup
