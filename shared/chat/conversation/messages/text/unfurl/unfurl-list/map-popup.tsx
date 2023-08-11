import * as Kb from '../../../../../../common-adapters/index'
import * as ConfigConstants from '../../../../../../constants/config'
import * as C from '../../../../../../constants'
import * as Constants from '../../../../../../constants/chat2'
import * as Styles from '../../../../../../styles'
import type * as Types from '../../../../../../constants/types/chat2'
import openURL from '../../../../../../util/open-url'
import LocationMap from '../../../../../location-map'

type Props = {
  conversationIDKey: Types.ConversationIDKey
  coord: Types.Coordinate
  isAuthor: boolean
  author?: string
  isLiveLocation: boolean
  url: string
}

const UnfurlMapPopup = (props: Props) => {
  const {coord, isAuthor, isLiveLocation, url} = props
  const author = props.author ?? ''
  const httpSrv = ConfigConstants.useConfigState(s => s.httpSrv)

  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onClose = () => {
    clearModals()
  }
  const onViewURL = () => {
    onClose()
    openURL(url)
  }
  const messageSend = Constants.useContext(s => s.dispatch.messageSend)
  const onStopSharing = () => {
    onClose()
    messageSend('/location stop')
  }

  const width = Math.ceil(Styles.dimensionWidth)
  const height = Math.ceil(Styles.dimensionHeight)
  const mapSrc = `http://${httpSrv.address}/map?lat=${coord.lat}&lon=${coord.lon}&width=${width}&height=${height}&token=${httpSrv.token}&username=${author}`
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
