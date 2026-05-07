import * as C from '@/constants'
import * as Kb from '@/common-adapters/index'
import * as T from '@/constants/types'
import {openURL} from '@/util/misc'
import LocationMap from '@/chat/location-map'
import {useConfigState} from '@/stores/config'
import {sendTextToConversation} from '../../../../send-actions'
import {useConversationMeta} from '../../../../data-hooks'

type Props = {
  conversationIDKey?: T.Chat.ConversationIDKey
  coord: T.Chat.Coordinate
  isAuthor: boolean
  author?: string
  isLiveLocation: boolean
  url: string
}

const UnfurlMapPopupInner = (props: Props) => {
  const {coord, conversationIDKey = T.Chat.noConversationIDKey, isAuthor, isLiveLocation, url} = props
  const author = props.author ?? ''
  const httpSrv = useConfigState(s => s.httpSrv)
  const {tlfname} = useConversationMeta(conversationIDKey)

  const clearModals = C.Router2.clearModals
  const onClose = () => {
    clearModals()
  }
  const onViewURL = () => {
    onClose()
    openURL(url)
  }
  const onStopSharing = () => {
    onClose()
    if (tlfname) {
      sendTextToConversation(conversationIDKey, tlfname, '/location stop')
    }
  }

  const width = Kb.Styles.isMobile ? Math.ceil(Kb.Styles.dimensionWidth) : 300
  const height = Kb.Styles.isMobile ? Math.ceil(Kb.Styles.dimensionHeight) : 300
  const mapSrc = `http://${httpSrv.address}/map?lat=${coord.lat}&lon=${coord.lon}&width=${width}&height=${height}&token=${httpSrv.token}&username=${author}`
  return (
    <>
      <LocationMap mapSrc={mapSrc} height={height} width={width} />
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.modalFooter}>
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
      </Kb.Box2>
    </>
  )
}

const UnfurlMapPopup = (props: Props) => {
  return <UnfurlMapPopupInner {...props} />
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  modalFooter: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
      borderStyle: 'solid' as const,
      borderTopColor: Kb.Styles.globalColors.black_10,
      borderTopWidth: 1,
      minHeight: 56,
    },
    isElectron: {
      borderBottomLeftRadius: Kb.Styles.borderRadius,
      borderBottomRightRadius: Kb.Styles.borderRadius,
      overflow: 'hidden',
    },
  }),
}))

export default UnfurlMapPopup
