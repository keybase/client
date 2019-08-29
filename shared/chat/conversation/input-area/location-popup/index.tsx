import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as Container from '../../../../util/container'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {isIOS} from '../../../../constants/platform'
import {imgMaxWidthRaw} from '../../messages/attachment/image/image-render'

type Props = {
  httpSrvAddress: string
  httpSrvToken: string
  onLocationShare: (duration: string) => void
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
  })
  React.useEffect(() => {
    const watchID = navigator.geolocation.watchPosition(
      pos => {
        setLocation({
          accuracy: pos.coords.accuracy,
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        })
      },
      err => {},
      {enableHighAccuracy: isIOS, maximumAge: 10000, timeout: 30000}
    )
    return () => {
      navigator.geolocation.clearWatch(watchID)
    }
  }, [])
  const onLocationShare = (duration: string) => {
    onClose()
    props.onLocationShare(duration)
  }

  const width = imgMaxWidthRaw()
  const height = 800
  const mapSrc = `http://${props.httpSrvAddress}/map?lat=${location.lat}&lon=${
    location.lon
  }&width=${width}&height=${height}&token=${props.httpSrvToken}`
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
            <Kb.Button fullWidth={true} onClick={() => onLocationShare('')} type="Default">
              <Kb.Box2 direction="vertical" centerChildren={true}>
                <Kb.Text type="BodySemibold" negative={true}>
                  Share current location
                </Kb.Text>
                <Kb.Text type="BodyTiny" style={styles.accuracy}>
                  Accurate to {location.accuracy} meters
                </Kb.Text>
              </Kb.Box2>
            </Kb.Button>
            <Kb.Divider />
            <Kb.Text type="BodySmall" center={true}>
              Live Location
            </Kb.Text>
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
          </Kb.Box2>
        ),
      }}
    >
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} gap="small" style={styles.container}>
        <Kb.Image src={mapSrc} style={{height, width}} />
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  accuracy: {
    color: Styles.globalColors.white_75,
    lineHeight: 14,
  },
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
}))

export default LocationPopup
