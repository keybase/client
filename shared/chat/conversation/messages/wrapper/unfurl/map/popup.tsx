import * as React from 'react'
import * as Kb from '../../../../../../common-adapters/index'
import * as Types from '../../../../../../constants/types/chat2'
import * as Container from '../../../../../../util/container'
import * as RouteTreeGen from '../../../../../../actions/route-tree-gen'
import * as Chat2Gen from '../../../../../../actions/chat2-gen'
import * as Styles from '../../../../../../styles'
import * as Constants from '../../../../../../constants/chat2'
import openURL from '../../../../../../util/open-url'
import HiddenString from '../../../../../../util/hidden-string'
import {imgMaxHeightRaw, imgMaxWidthRaw} from '../../../attachment/image/image-render'

type Props = Container.RouteProps<{
  conversationIDKey: Types.ConversationIDKey
  coord: Types.Coordinate
  isAuthor: boolean
  isLiveLocation: boolean
  url: string
}>

const UnfurlMapPopup = (props: Props) => {
  const conversationIDKey = Container.getRouteProps(props, 'conversationIDKey', Constants.noConversationIDKey)
  const coord = Container.getRouteProps(props, 'coord', {accuracy: 0, lat: 0, lon: 0})
  const isAuthor = Container.getRouteProps(props, 'isAuthor', false)
  const isLiveLocation = Container.getRouteProps(props, 'isLiveLocation', false)
  const url = Container.getRouteProps(props, 'url', '')
  // state
  const {httpSrvAddress, httpSrvToken} = Container.useSelector(state => ({
    httpSrvAddress: state.config.httpSrvAddress,
    httpSrvToken: state.config.httpSrvToken,
  }))
  const [mapLoaded, setMapLoaded] = React.useState(false)
  //dispatch
  const dispatch = Container.useDispatch()
  const onClose = () => {
    dispatch(RouteTreeGen.createClearModals())
  }
  const onViewURL = () => {
    onClose()
    openURL(url)
  }
  const onStopSharing = () => {
    onClose()
    dispatch(
      Chat2Gen.createMessageSend({
        conversationIDKey,
        text: new HiddenString('/location stop'),
      })
    )
  }

  // render
  const width = imgMaxWidthRaw()
  const height = imgMaxHeightRaw()
  const mapSrc = `http://${httpSrvAddress}/map?lat=${coord.lat}&lon=${
    coord.lon
  }&width=${width}&height=${height}&token=${httpSrvToken}`

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
          <Kb.Box2 direction="vertical" gap="small" fullWidth={true}>
            <Kb.Button fullWidth={true} onClick={onViewURL} label="View on Google Maps" type="Default" />
            {isAuthor && isLiveLocation && (
              <Kb.Button
                fullWidth={true}
                onClick={onStopSharing}
                label="Stop sharing your location"
                type="Danger"
                mode="Secondary"
              />
            )}
          </Kb.Box2>
        ),
      }}
    >
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} gap="small" style={styles.container}>
        {!!mapSrc && <Kb.Image src={mapSrc} style={{height, width}} onLoad={() => setMapLoaded(true)} />}
        {!mapLoaded && <Kb.ProgressIndicator style={styles.loading} />}
        <Kb.Box2
          style={styles.banner}
          direction="horizontal"
          fullWidth={true}
          centerChildren={true}
          gap="xxtiny"
        >
          <Kb.Text type="BodyTiny">Your location is protected.</Kb.Text>
          <Kb.Text
            type="BodyTinyLink"
            style={styles.learn}
            onClickURL="https://keybase.io/docs/chat/location"
          >
            Learn more
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Modal>
  )
}

export default UnfurlMapPopup

const styles = Styles.styleSheetCreate(() => ({
  banner: {
    backgroundColor: Styles.globalColors.white,
    borderBottomWidth: 1,
    borderColor: Styles.globalColors.black_10,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  container: {
    ...Styles.globalStyles.fillAbsolute,
    justifyContent: 'center',
  },
  learn: {
    color: Styles.globalColors.blueDark,
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
