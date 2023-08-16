import * as C from '../../../../../constants'
import Journeycard from '.'
import * as T from '../../../../../constants/types'
import * as React from 'react'
import type {Position, StylesCrossPlatform} from '../../../../../styles'

type OwnProps = {
  attachTo?: () => React.Component<any> | null
  onHidden: () => void
  ordinal: T.Chat.Ordinal
  position: Position
  style?: StylesCrossPlatform
  visible: boolean
}

export default (ownProps: OwnProps) => {
  const {ordinal} = ownProps
  const cardType = C.useChatContext(
    s => s.messageMap.get(ordinal)?.cardType ?? T.RPCChat.JourneycardType.unused
  )

  const dismissJourneycard = C.useChatContext(s => s.dispatch.dismissJourneycard)
  const _onDismiss = (cardType: T.RPCChat.JourneycardType, ordinal: T.Chat.Ordinal) => {
    dismissJourneycard(cardType, ordinal)
  }
  const props = {
    attachTo: ownProps.attachTo,
    onDismiss: () => {
      _onDismiss(cardType, ownProps.ordinal)
    },
    onHidden: () => ownProps.onHidden(),
    position: ownProps.position,
    style: ownProps.style,
    visible: ownProps.visible,
  }
  return <Journeycard {...props} />
}
