import * as Kb from '../../../../../../common-adapters/index'
import * as Container from '../../../../../../util/container'
import * as RouteTreeGen from '../../../../../../actions/route-tree-gen'
import * as Chat2Gen from '../../../../../../actions/chat2-gen'
import * as Styles from '../../../../../../styles'
import openURL from '../../../../../../util/open-url'
import LocationMap from '../../../../../location-map'
import HiddenString from '../../../../../../util/hidden-string'

type Props = Container.RouteProps2<'chatUnfurlMapPopup'>

const UnfurlMapPopup = (props: Props) => {
  const {params} = props.route
  const {coord, isAuthor, isLiveLocation, url, conversationIDKey} = params
  const author = params.author ?? ''
  const httpSrvAddress = Container.useSelector(state => state.config.httpSrvAddress)
  const httpSrvToken = Container.useSelector(state => state.config.httpSrvToken)

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

  const width = Math.ceil(Styles.dimensionWidth)
  const height = Math.ceil(Styles.dimensionHeight)
  const mapSrc = `http://${httpSrvAddress}/map?lat=${coord.lat}&lon=${coord.lon}&width=${width}&height=${height}&token=${httpSrvToken}&username=${author}`
  return (
    <Kb.Modal
      scrollViewContainerStyle={{maxWidth: undefined}}
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
      <LocationMap mapSrc={mapSrc} height={height} width={width} />
    </Kb.Modal>
  )
}

export default UnfurlMapPopup
