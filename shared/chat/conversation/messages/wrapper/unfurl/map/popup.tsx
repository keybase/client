import * as React from 'react'
import * as Kb from '../../../../../../common-adapters/index'
import * as Types from '../../../../../../constants/types/chat2'
import * as Container from '../../../../../../util/container'
import * as RouteTreeGen from '../../../../../../actions/route-tree-gen'
import * as Chat2Gen from '../../../../../../actions/chat2-gen'
import * as Constants from '../../../../../../constants/chat2'
import * as Styles from '../../../../../../styles'
import openURL from '../../../../../../util/open-url'
import HiddenString from '../../../../../../util/hidden-string'

type Props = Container.RouteProps<{
  conversationIDKey: Types.ConversationIDKey
  coord: Types.Coordinate
  isAuthor: boolean
  author?: string
  isLiveLocation: boolean
  url: string
}>

const UnfurlMapPopup = (props: Props) => {
  const conversationIDKey = Container.getRouteProps(props, 'conversationIDKey', Constants.noConversationIDKey)
  const coord = Container.getRouteProps(props, 'coord', {accuracy: 0, lat: 0, lon: 0})
  const isAuthor = Container.getRouteProps(props, 'isAuthor', false)
  const author = Container.getRouteProps(props, 'author', '')
  const isLiveLocation = Container.getRouteProps(props, 'isLiveLocation', false)
  const url = Container.getRouteProps(props, 'url', '')
  // state
  const {httpSrvAddress, httpSrvToken} = Container.useSelector(state => ({
    httpSrvAddress: state.config.httpSrvAddress,
    httpSrvToken: state.config.httpSrvToken,
  }))

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
  const width = Math.ceil(Styles.dimensionWidth)
  const height = Math.ceil(Styles.dimensionHeight)
  const mapSrc = `http://${httpSrvAddress}/map?lat=${coord.lat}&lon=${coord.lon}&width=${width}&height=${height}&token=${httpSrvToken}&username=${author}`
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
      <Kb.LocationMap mapSrc={mapSrc} height={height} width={width} />
    </Kb.Modal>
  )
}

export default UnfurlMapPopup
