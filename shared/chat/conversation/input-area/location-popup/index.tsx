import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as Container from '../../../../util/container'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {isIOS} from '../../../../constants/platform'
import {imgMaxWidthRaw} from '../../messages/attachment/image/image-render'

type Props = {
  httpSrvAddress: string
  httpSrvToken: string
  lastCoord: Types.Coordinate | null
  onLocationShare: (duration: string) => void
}

const LocationPopup = (props: Props) => {
  const dispatch = Container.useDispatch()
  const onClose = React.useCallback(() => {
    dispatch(RouteTreeGen.createClearModals())
  }, [dispatch])
  const [mapLoaded, setMapLoaded] = React.useState(false)
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
  const onLocationShare = (duration: string) => {
    onClose()
    props.onLocationShare(duration)
  }

  const width = imgMaxWidthRaw()
  const height = 400
  const location = props.lastCoord
  const mapSrc = location
    ? `http://${props.httpSrvAddress}/map?lat=${location.lat}&lon=${
        location.lon
      }&width=${width}&height=${height}&token=${props.httpSrvToken}`
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
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} gap="small" style={styles.container}>
        {!!mapSrc && <Kb.Image src={mapSrc} style={{height, width}} onLoad={() => setMapLoaded(true)} />}
        {!mapLoaded && <Kb.ProgressIndicator style={styles.loading} />}
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
    height: 53,
  },
  loading: {
    bottom: '50%',
    left: '50%',
    marginBottom: -12,
    marginLeft: -12,
    marginRight: -12,
    marginTop: -12,
    position: 'absolute',
    right: '50%',
    top: '50%',
    width: 24,
  },
}))

export default LocationPopup
