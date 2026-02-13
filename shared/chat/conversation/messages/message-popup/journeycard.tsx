import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as React from 'react'
import type {Position, StylesCrossPlatform} from '@/styles'

type OwnProps = {
  attachTo?: React.RefObject<Kb.MeasureRef | null>
  onHidden: () => void
  ordinal: T.Chat.Ordinal
  position: Position
  style?: StylesCrossPlatform
  visible: boolean
}

const JourneyCard = (ownProps: OwnProps) => {
  const {ordinal, attachTo, onHidden, style, visible, position} = ownProps
  const cardType = Chat.useChatContext(
    s => s.messageMap.get(ordinal)?.cardType ?? T.RPCChat.JourneycardType.unused
  )

  const dismissJourneycard = Chat.useChatContext(s => s.dispatch.dismissJourneycard)
  const onDismiss = React.useCallback(() => {
    dismissJourneycard(cardType, ordinal)
  }, [dismissJourneycard, cardType, ordinal])

  const items: Kb.MenuItems = [{icon: 'iconfont-close', onClick: onDismiss, title: 'Dismiss message'}]

  return (
    <Kb.FloatingMenu
      attachTo={attachTo}
      closeOnSelect={true}
      items={items}
      onHidden={onHidden}
      position={position}
      containerStyle={style}
      visible={visible}
      safeProviderStyle={safeProviderStyle}
    />
  )
}
const safeProviderStyle = {flex: 1} as const
export default JourneyCard
