import * as C from '@/constants'
import * as Kb from '@/common-adapters/index'
import type * as T from '@/constants/types'
import openURL from '@/util/open-url'
import LocationMap from '@/chat/location-map'

type Props = {
  coord: T.Chat.Coordinate
  isAuthor: boolean
  author?: string
  isLiveLocation: boolean
  url: string
}

const UnfurlMapPopup = (props: Props) => {
  const {coord, isAuthor, isLiveLocation, url} = props
  const author = props.author ?? ''
  const httpSrv = C.useConfigState(s => s.httpSrv)

  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onClose = () => {
    clearModals()
  }
  const onViewURL = () => {
    onClose()
    openURL(url)
  }
  const messageSend = C.useChatContext(s => s.dispatch.messageSend)
  const onStopSharing = () => {
    onClose()
    messageSend('/location stop')
  }

  const width = Kb.Styles.isMobile ? Math.ceil(Kb.Styles.dimensionWidth) : 300
  const height = Kb.Styles.isMobile ? Math.ceil(Kb.Styles.dimensionHeight) : 300
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
